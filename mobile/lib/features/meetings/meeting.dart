/// 월례회 자료의 열람 상태 (SPEC_API §7.1)
enum MeetingStatus {
  scheduled('SCHEDULED'),
  open('OPEN'),
  closed('CLOSED'),

  /// 집합 밖의 값 — 열 수 없는 것으로 본다
  unknown('');

  const MeetingStatus(this.wire);

  final String wire;

  static MeetingStatus parse(String? raw) =>
      values.firstWhere((s) => s.wire == raw, orElse: () => unknown);
}

/// 월례회 자료 목록의 한 줄 (SPEC_API §7.1)
class MeetingSummary {
  const MeetingSummary({
    required this.id,
    required this.title,
    required this.meetingDate,
    required this.pageCount,
    required this.viewableFrom,
    required this.viewableUntil,
    required this.status,
  });

  factory MeetingSummary.fromJson(Map<String, dynamic> json) => MeetingSummary(
    id: json['id'] as String,
    title: json['title'] as String,
    meetingDate: json['meetingDate'] as String,
    pageCount: json['pageCount'] as int,
    viewableFrom: DateTime.parse(json['viewableFrom'] as String),
    viewableUntil: DateTime.parse(json['viewableUntil'] as String),
    status: MeetingStatus.parse(json['status'] as String?),
  );

  final String id;
  final String title;

  /// `YYYY-MM-DD`
  final String meetingDate;
  final int pageCount;

  /// UTC
  final DateTime viewableFrom;
  final DateTime viewableUntil;
  final MeetingStatus status;
}

/// 월례회 자료 하나 — 열 수 있는지는 **요청한 사람 기준**이다 (SPEC_API §7.2).
/// 같은 자료도 회원은 `canView: false`, 임원은 `true`일 수 있다
class MeetingDetail {
  const MeetingDetail({
    required this.id,
    required this.title,
    required this.meetingDate,
    required this.pageCount,
    required this.status,
    required this.viewableUntil,
    required this.remainingSeconds,
    required this.canView,
  });

  factory MeetingDetail.fromJson(Map<String, dynamic> json) => MeetingDetail(
    id: json['id'] as String,
    title: json['title'] as String,
    meetingDate: json['meetingDate'] as String,
    pageCount: json['pageCount'] as int,
    status: MeetingStatus.parse(json['status'] as String?),
    viewableUntil: DateTime.parse(json['viewableUntil'] as String),
    remainingSeconds: json['remainingSeconds'] as int? ?? 0,
    canView: json['canView'] as bool,
  );

  final String id;
  final String title;
  final String meetingDate;
  final int pageCount;
  final MeetingStatus status;

  /// UTC
  final DateTime viewableUntil;

  /// 서버가 잰 남은 시간. 기기 시계가 틀려도 이 값을 기준으로 센다
  final int remainingSeconds;

  /// ⚠️ 화면 분기용일 뿐 보안이 아니다 — 페이지를 줄 때 서버가 매번 다시 본다
  /// (SPEC_API §7.3 처리 순서 2). 그래서 페이지의 403도 정상 경로로 다룬다.
  /// `viewReason`은 받지 않는다 — 열람 전에도 `PERIOD_CLOSED`로 오는 등
  /// 믿을 수 없어 문구는 [status]로 고른다 (#236 주의)
  final bool canView;
}
