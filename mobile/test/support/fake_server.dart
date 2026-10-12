import 'dart:convert';
import 'dart:typed_data';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:light_mobile/core/api/api_client.dart';

/// 실제 백엔드 대신 [ApiClient]에 끼우는 가짜 서버 (테스트 공용)

typedef FakeResponse = ({
  int status,
  String body,
  Map<String, List<String>> headers,
});

/// JSON 본문에는 실제 서버처럼 `Content-Type: application/json`을 붙인다 —
/// 붙이지 않으면 dio가 JSON을 다르게 다루는 경로(자동 해석)를 테스트가 놓친다.
/// 실제로 놓쳐서 에뮬레이터에서야 드러난 적이 있다 (M8 바이트 받기)
FakeResponse respond(
  int status, [
  Object? json,
  Map<String, List<String>>? headers,
]) => (
  status: status,
  body: json == null ? '' : (json is String ? json : jsonEncode(json)),
  headers:
      headers ??
      (json == null || json is String
          ? const {}
          : const {
              'content-type': ['application/json'],
            }),
);

FakeResponse unauthorized() => respond(401, {
  'error': {'code': 'UNAUTHORIZED', 'message': '로그인이 필요합니다.', 'field': null},
});

/// 요청을 기록하고 [handler]가 정한 응답을 돌려주는 가짜 서버
class FakeServer implements HttpClientAdapter {
  FakeServer(this.handler);

  final Future<FakeResponse> Function(RequestOptions options) handler;
  final requests = <RequestOptions>[];

  List<String> get paths => [for (final r in requests) '${r.method} ${r.path}'];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final res = await handler(options);
    return ResponseBody.fromString(res.body, res.status, headers: res.headers);
  }

  @override
  void close({bool force = false}) {}
}

ApiClient clientFor(FakeServer server) => ApiClient(
  baseUrl: 'http://localhost:8080/api',
  cookieJar: CookieJar(),
  adapter: server,
);
