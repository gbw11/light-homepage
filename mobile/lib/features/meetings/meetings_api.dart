import '../../core/api/api_client.dart';
import '../../core/api/page.dart';
import 'meeting.dart';

/// 월례회 자료 API (SPEC_API §7). 목록은 자료 탭의 "열람 중" 표시가 쓴다.
/// 뷰어는 묶음 D(#236)에서 붙인다
class MeetingsApi {
  const MeetingsApi(this._client);

  final ApiClient _client;

  /// 최신순
  Future<PageResult<MeetingSummary>> list({int? page, int? size}) =>
      _client.get(
        '/meetings',
        query: {'page': page, 'size': size},
        decode: (data) => PageResult.fromJson(data, MeetingSummary.fromJson),
      );
}
