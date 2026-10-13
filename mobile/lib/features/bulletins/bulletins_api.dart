import 'package:dio/dio.dart';

import '../../core/api/api_client.dart';
import '../../core/api/page.dart';
import 'bulletin.dart';

/// 주보 API (SPEC_API §5). 모두 회원(M) — 비로그인은 401
class BulletinsApi {
  const BulletinsApi(this._client);

  final ApiClient _client;

  /// 최신순
  Future<PageResult<BulletinSummary>> list({int? page, int? size}) =>
      _client.get(
        '/bulletins',
        query: {'page': page, 'size': size},
        decode: (data) => PageResult.fromJson(data, BulletinSummary.fromJson),
      );

  /// 가장 최근 주보 — 모든 장의 큰 이미지까지 온다. 없으면 null (SPEC_API §5.1)
  Future<Bulletin?> latest() => _client.get(
    '/bulletins/latest',
    decode: (data) => switch (data) {
      final Map<String, dynamic> json => Bulletin.fromJson(json),
      _ => null,
    },
  );

  Future<Bulletin> get(String id) => _client.get(
    '/bulletins/$id',
    decode: (data) => Bulletin.fromJson(data as Map<String, dynamic>),
  );

  /// 주보 올리기 — 임원(L) (SPEC_API §5.4). 만든 주보의 id를 돌려준다.
  ///
  /// **[pages]의 순서가 곧 장 순서다.** 같은 날짜가 이미 있으면 `DUPLICATE` —
  /// 교체 엔드포인트가 없어 [remove] 후 다시 올린다 (웹과 같다).
  /// 이미지는 JPEG · PNG · WebP, 한 장 8MB · 최대 20장 (서버 규칙)
  Future<String> create({
    required String serviceDate,
    required List<UploadImage> pages,
  }) => _client.postForm(
    '/bulletins',
    form: () => FormData.fromMap({
      'serviceDate': serviceDate,
      'pages': [
        for (final (i, page) in pages.indexed)
          MultipartFile.fromBytes(
            page.bytes,
            // 파일명이 없으면 서버가 파트를 파일로 보지 못하는 구현이 있다 (웹 주석)
            filename: 'page-${i + 1}.${page.extension}',
            contentType: DioMediaType.parse(page.mimeType),
          ),
      ],
    }),
    decode: (data) => (data as Map<String, dynamic>)['id'] as String,
  );

  /// 주보 지우기 — 임원(L), R2 객체까지 지운다 (SPEC_API §5.5)
  Future<void> remove(String id) => _client.delete('/bulletins/$id');
}

/// 올릴 이미지 한 장 — 고른 사진을 줄여 담은 것
typedef UploadImage = ({List<int> bytes, String mimeType, String extension});
