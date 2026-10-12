import '../../core/api/api_client.dart';
import '../../core/api/page.dart';
import 'live_stream.dart';
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

  /// 지금 라이브 중인 방송. 아니면 `null` — 404가 아니라 정상 응답이다.
  /// 서버 캐시가 60초라 그보다 자주 물어도 같은 답이 온다
  Future<LiveStream?> live() => _client.get(
    '/sermons/live',
    decode: (data) => switch (data) {
      final Map<String, dynamic> json => LiveStream.fromJson(json),
      _ => null,
    },
  );
}
