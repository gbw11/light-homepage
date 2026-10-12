import 'dart:typed_data';

import '../../core/api/api_client.dart';
import '../../core/api/page.dart';
import 'meeting.dart';

/// 월례회 자료 API (SPEC_API §7). 모두 회원(M).
///
/// 이 리소스는 서명 URL을 주지 않는다 — 기간이 끝나도 주소가 살아 있게 되므로
/// 서버가 페이지마다 워터마크를 합성해 **직접 보낸다** (§7 머리말)
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

  Future<MeetingDetail> get(String id) => _client.get(
    '/meetings/$id',
    decode: (data) => MeetingDetail.fromJson(data as Map<String, dynamic>),
  );

  /// 워터마크가 들어간 페이지 이미지(JPEG). [pageNo]는 1부터.
  /// 기간 밖의 회원은 403 — 보던 중에 마감 시각이 지나도 그렇다
  Future<Uint8List> page(String id, int pageNo) =>
      _client.getBytes('/meetings/$id/pages/$pageNo');
}
