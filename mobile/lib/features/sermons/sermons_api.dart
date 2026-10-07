import '../../core/api/api_client.dart';
import '../../core/api/page.dart';
import 'sermon.dart';

/// 설교 영상 API (SPEC_API §9.2)
class SermonsApi {
  const SermonsApi(this._client);

  final ApiClient _client;

  /// 최신순. YouTube 쪽이 실패하면 서버가 빈 목록이나 502를 준다 — 둘 다 "영상 없음"으로 다룬다
  Future<PageResult<Sermon>> list({int? page, int? size}) => _client.get(
    '/sermons',
    query: {'page': page, 'size': size},
    decode: (data) => PageResult.fromJson(data, Sermon.fromJson),
  );
}
