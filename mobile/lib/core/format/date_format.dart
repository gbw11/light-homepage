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

/// `2026-08-24` → `2026.08.24`. 주보 날짜처럼 시각 없이 날짜만 오는 값
/// (SPEC_API §1.3 — 시간대를 바꾸지 않는다. 바꾸면 하루가 밀린다)
String formatYmd(String ymd) => ymd.replaceAll('-', '.');

/// `10/9 23:59` — 월례회 열람 마감처럼 날짜와 시각을 짧게
String formatMonthDayTime(DateTime at) {
  final local = at.toLocal();
  final hh = local.hour.toString().padLeft(2, '0');
  final mm = local.minute.toString().padLeft(2, '0');
  return '${local.month}/${local.day} $hh:$mm';
}
