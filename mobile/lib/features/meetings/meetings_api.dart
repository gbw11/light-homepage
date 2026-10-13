import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../../core/api/api_client.dart';
import '../../core/api/page.dart';
import '../../core/upload/pick_file.dart';
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

  /// 월례회 자료 올리기 — 임원(L) (SPEC_API §7.4). 만든 자료의 id를 돌려준다.
  ///
  /// 서버가 PDF를 장마다 이미지로 바꾸는 **동기 처리**다 (10쪽 ≈ 1초, 상한 50쪽).
  /// 열람 기간은 UTC로 보낸다 — 기기 시각 그대로 보내면 한국에서 9시간 어긋난다
  /// (웹 `meetingWindow.ts`와 같은 이유). PDF 원본은 서버에 남지 않는다
  Future<String> create({
    required String title,
    required String meetingDate,
    required DateTime viewableFrom,
    required DateTime viewableUntil,
    required UploadFile pdf,
  }) => _client.postForm(
    '/meetings',
    form: () => FormData.fromMap({
      'title': title,
      'meetingDate': meetingDate,
      'viewableFrom': viewableFrom.toUtc().toIso8601String(),
      'viewableUntil': viewableUntil.toUtc().toIso8601String(),
      'file': MultipartFile.fromBytes(
        pdf.bytes,
        filename: pdf.name,
        contentType: DioMediaType.parse(pdf.mimeType),
      ),
    }),
    decode: (data) => (data as Map<String, dynamic>)['id'] as String,
  );
}
