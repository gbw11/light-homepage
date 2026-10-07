// 화면에 쓰는 날짜 표기. 서버 시각은 UTC라서 (SPEC_API §1.3) 기기 시간대로 바꿔서 쓴다.
// 웹(`frontend/src/app/home/_components`)과 같은 모양이다.

/// `10/5` — 공지 목록처럼 좁은 칸
String formatMonthDay(DateTime at) {
  final local = at.toLocal();
  return '${local.month}/${local.day}';
}

/// `2026.10.05` — 설교 카드
String formatDotDate(DateTime at) {
  final local = at.toLocal();
  final mm = local.month.toString().padLeft(2, '0');
  final dd = local.day.toString().padLeft(2, '0');
  return '${local.year}.$mm.$dd';
}
