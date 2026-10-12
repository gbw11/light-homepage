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
