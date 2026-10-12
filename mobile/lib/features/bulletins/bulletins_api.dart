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

  Future<Bulletin> get(String id) => _client.get(
    '/bulletins/$id',
    decode: (data) => Bulletin.fromJson(data as Map<String, dynamic>),
  );
}
