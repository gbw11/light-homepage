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

/// `10.4` — 글 카드. 올해가 아니면 `2025.10.4`로 해를 붙인다
/// (소식 목록은 끝까지 내리면 지난해 글도 나온다)
String formatShortDate(DateTime at, {DateTime? now}) {
  final local = at.toLocal();
  final short = '${local.month}.${local.day}';
  return local.year == (now ?? DateTime.now()).year
      ? short
      : '${local.year}.$short';
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

/// 남은 시간 — `1일 3시간 남음` · `2시간 5분 남음` · `4분 30초 남음`
String formatRemaining(int seconds) {
  if (seconds <= 0) return '마감';
  final d = seconds ~/ 86400;
  final h = seconds % 86400 ~/ 3600;
  final m = seconds % 3600 ~/ 60;
  final s = seconds % 60;
  if (d > 0) return '$d일 $h시간 남음';
  if (h > 0) return '$h시간 $m분 남음';
  return '$m분 $s초 남음';
}
