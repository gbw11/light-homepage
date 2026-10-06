import 'dart:async';
import 'dart:convert';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:path_provider/path_provider.dart';

import '../config.dart';
import 'api_error.dart';

/// 응답의 `data`를 화면이 쓸 타입으로 바꾸는 함수
typedef Decoder<T> = T Function(Object? data);

/// 백엔드 호출의 유일한 입구. 웹의 `frontend/src/lib/api/real.ts`와 같은 규칙을 따른다.
///
/// 웹과 다른 점은 둘이다.
///   · 같은 출처 프록시가 없어 백엔드 주소([apiBaseUrl])를 직접 부른다
///   · 브라우저 대신 [CookieJar]가 httpOnly 쿠키(JWT)를 보관하고 요청에 싣는다.
///     그래서 앱 코드도 웹처럼 **토큰을 직접 다루지 않는다** (SPEC_API §1.4)
class ApiClient {
  ApiClient({
    required String baseUrl,
    required CookieJar cookieJar,
    HttpClientAdapter? adapter,
  }) : _dio = Dio(
         BaseOptions(
           baseUrl: baseUrl,
           // 상태 코드와 상관없이 봉투({data}/{error})를 직접 해석한다
           validateStatus: (_) => true,
           responseType: ResponseType.plain,
           contentType: Headers.jsonContentType,
           connectTimeout: const Duration(seconds: 15),
           receiveTimeout: const Duration(seconds: 60),
         ),
       ) {
    _dio.interceptors.add(CookieManager(cookieJar));
    if (adapter != null) _dio.httpClientAdapter = adapter;
  }

  /// 앱 저장소에 쿠키를 보관하는 실제 클라이언트. 앱을 껐다 켜도 로그인이 유지된다.
  static Future<ApiClient> create() async {
    final dir = await getApplicationSupportDirectory();
    return ApiClient(
      baseUrl: apiBaseUrl,
      cookieJar: PersistCookieJar(storage: FileStorage('${dir.path}/cookies/')),
    );
  }

  final Dio _dio;

  /// 401을 만나도 리프레시를 시도하면 **안 되는** 경로 (SPEC_API §12.2).
  ///
  /// · `/auth/refresh` — 자기 자신을 재귀 호출하게 된다
  /// · `/auth/login`   — 여기서의 401은 토큰 만료가 아니라 **비밀번호가 틀림**이다
  /// · 익명(G) 가입·재설정 경로 — 401은 "명단 불일치·토큰/코드 만료"다.
  ///   리프레시가 실패해 세션 만료를 알리면 가입하던 사용자가 이유 없이 튕긴다
  static const _noRefreshPaths = {
    '/auth/refresh',
    '/auth/login',
    '/auth/verify-roster',
    '/auth/register',
    '/auth/password/reset-with-code',
  };

  /// 리프레시로도 살릴 수 없는 세션. 받는 쪽이 로그인 상태를 비우고 로그인 화면으로 보낸다
  Stream<void> get sessionExpired => _sessionExpired.stream;
  final _sessionExpired = StreamController<void>.broadcast();

  /// 진행 중인 리프레시 요청 (single-flight).
  ///
  /// ⚠️ 리프레시 토큰은 **사용 시 회전**한다 (SPEC_API §2.4). 동시에 터진 401
  /// 여러 개가 각자 리프레시를 보내면 두 번째부터는 이미 폐기된 토큰을 써서
  /// 멀쩡한 세션이 끊긴다. 그래서 동시 요청은 하나의 Future를 공유한다.
  Future<void>? _refreshInFlight;

  Future<T> get<T>(
    String path, {
    Map<String, Object?>? query,
    required Decoder<T> decode,
  }) => _request('GET', path, query: query, decode: decode);

  Future<T> post<T>(String path, {Object? body, required Decoder<T> decode}) =>
      _request('POST', path, body: body, decode: decode);

  /// 본문 없는 응답(204)을 기대하는 POST — logout 등
  Future<void> postNoContent(String path, {Object? body}) =>
      _request('POST', path, body: body, decode: (_) {});

  /// 401 처리 흐름 (SPEC_API §12.2):
  ///
  ///   401 → POST /auth/refresh **1회** 시도
  ///     성공 → 원래 요청을 **정확히 1회** 재시도 (또 401이면 그대로 던진다)
  ///     실패 → [sessionExpired]를 알리고 원래의 401을 던진다
  Future<T> _request<T>(
    String method,
    String path, {
    Map<String, Object?>? query,
    Object? body,
    required Decoder<T> decode,
  }) async {
    try {
      return await _rawRequest(
        method,
        path,
        query: query,
        body: body,
        decode: decode,
      );
    } on ApiError catch (error, stack) {
      if (error.code != ErrorCode.unauthorized ||
          _noRefreshPaths.contains(path)) {
        rethrow;
      }

      try {
        await _refreshOnce();
      } on ApiError {
        _sessionExpired.add(null);
        // 리프레시의 에러가 아니라 원래 요청의 401을 전달한다 (호출부가 분기에 쓴다)
        Error.throwWithStackTrace(error, stack);
      }

      return _rawRequest(
        method,
        path,
        query: query,
        body: body,
        decode: decode,
      );
    }
  }

  Future<void> _refreshOnce() => _refreshInFlight ??= _rawRequest(
    'POST',
    '/auth/refresh',
    decode: (_) {},
    // 성공이든 실패든 비워야 다음 만료 때 다시 시도할 수 있다
  ).whenComplete(() => _refreshInFlight = null);

  /// 리프레시 재시도가 없는 순수 요청 1회
  Future<T> _rawRequest<T>(
    String method,
    String path, {
    Map<String, Object?>? query,
    Object? body,
    required Decoder<T> decode,
  }) async {
    final res = await _dio.request<String>(
      path,
      data: body,
      queryParameters: {
        for (final MapEntry(:key, :value) in (query ?? {}).entries) key: ?value,
      },
      options: Options(method: method),
    );
    final status = res.statusCode ?? 0;
    final text = res.data ?? '';

    // 204는 본문이 없다 (logout 등, SPEC_API §2)
    if (status == 204 || text.isEmpty) return decode(null);

    final Object? json;
    try {
      json = jsonDecode(text);
    } on FormatException {
      // 규약을 벗어난 응답 (프록시 실패·502 HTML 등). 화면이 분기할 일이 아니라
      // 공통 안내만 띄우면 되므로 INTERNAL_ERROR로 둔다
      throw ApiError(
        code: ErrorCode.internalError,
        message: '서버 응답을 해석할 수 없습니다 ($status)',
        status: status,
      );
    }

    if (json case {'error': final Map<String, dynamic> error}) {
      throw ApiError(
        code: ErrorCode.parse(error['code'] as String?),
        message: error['message'] as String? ?? '',
        field: error['field'] as String?,
        status: status,
      );
    }
    if (json case {'data': final data}) return decode(data);

    throw ApiError(
      code: ErrorCode.internalError,
      message: '서버 응답 형식이 올바르지 않습니다 ($status)',
      status: status,
    );
  }
}
