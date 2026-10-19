// 생년월일 입력 검사 — 회원가입(명단 확인)과 새가족 등록이 같이 쓴다.
// 서버도 같은 규칙으로 거른다 (SPEC_API §2.1 · §9.1): YYYY-MM-DD · 실제 날짜 ·
// 1900년 이후 · 미래가 아님.

/// `YYYY-MM-DD` 모양이고 실제 있는 날짜인지 — `2001-02-30`은 모양만 맞다
bool isValidBirthDate(String value) {
  final match = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(value);
  if (match == null) return false;
  final [y, m, d] = [for (var i = 1; i <= 3; i++) int.parse(match[i]!)];
  final date = DateTime.utc(y, m, d);
  // 없는 날짜는 DateTime이 다음 달로 넘겨 버린다 — 되돌려 비교한다
  return date.year == y &&
      date.month == m &&
      date.day == d &&
      y >= 1900 &&
      date.isBefore(DateTime.now().toUtc());
}
