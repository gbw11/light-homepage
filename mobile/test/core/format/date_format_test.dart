import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/core/format/date_format.dart';

void main() {
  test('짧은 날짜는 월/일, 앞자리 0 없이', () {
    expect(formatMonthDay(DateTime(2026, 3, 5)), '3/5');
    expect(formatMonthDay(DateTime(2026, 10, 12)), '10/12');
  });

  test('점 날짜는 연.월.일, 두 자리로 채운다', () {
    expect(formatDotDate(DateTime(2026, 3, 5)), '2026.03.05');
  });

  test('서버의 UTC 시각을 기기 시간대 날짜로 바꾼다', () {
    // 한국에서는 10/4 15:30 UTC가 10/5 00:30이다 — 날짜가 하루 넘어간다
    final utc = DateTime.utc(2026, 10, 4, 15, 30);
    final local = utc.toLocal();

    expect(formatMonthDay(utc), '${local.month}/${local.day}');
  });
}
