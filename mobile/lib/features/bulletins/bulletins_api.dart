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
}
