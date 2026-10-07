import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/core/theme/app_colors.dart';
import 'package:light_mobile/core/theme/app_theme.dart';

/// WCAG 명도 대비 — (밝은 쪽 + 0.05) / (어두운 쪽 + 0.05)
double contrast(Color a, Color b) {
  final la = a.computeLuminance();
  final lb = b.computeLuminance();
  final (hi, lo) = la > lb ? (la, lb) : (lb, la);
  return (hi + 0.05) / (lo + 0.05);
}

void main() {
  final scheme = buildAppTheme().colorScheme;

  test('정한 색이 그대로 들어간다', () {
    expect(scheme.surface, AppColors.surface);
    expect(scheme.surfaceContainer, AppColors.surfaceContainer);
    expect(scheme.primary, AppColors.primary);
    expect(scheme.onSurface, AppColors.onSurface);
  });

  test('컨테이너 단계가 모두 크림 계열이다 (씨앗의 초록빛 회색이 섞이지 않는다)', () {
    expect(
      {
        scheme.surfaceContainerLow,
        scheme.surfaceContainer,
        scheme.surfaceContainerHigh,
        scheme.surfaceContainerHighest,
      },
      {AppColors.surfaceContainer},
    );
    expect(scheme.surfaceContainerLowest, AppColors.surface);
  });

  group('글자 대비 4.5:1 이상 (NFR-A11Y-01)', () {
    final pairs = {
      '본문 / 배경': (scheme.onSurface, scheme.surface),
      '본문 / 카드': (scheme.onSurface, scheme.surfaceContainer),
      '보조 텍스트 / 배경': (scheme.onSurfaceVariant, scheme.surface),
      '보조 텍스트 / 카드': (scheme.onSurfaceVariant, scheme.surfaceContainer),
      '버튼 글자 / 버튼': (scheme.onPrimary, scheme.primary),
      '초록 링크 글자 / 배경': (scheme.primary, scheme.surface),
      '초록 링크 글자 / 카드': (scheme.primary, scheme.surfaceContainer),
      '경고 / 배경': (scheme.error, scheme.surface),
      '경고 버튼 글자 / 경고 버튼': (scheme.onError, scheme.error),
    };
    pairs.forEach((name, pair) {
      test(name, () {
        final (fg, bg) = pair;
        expect(contrast(fg, bg), greaterThanOrEqualTo(4.5));
      });
    });
  });

  test('테두리는 배경과 3:1 이상 구분된다 (WCAG 1.4.11 비텍스트 대비)', () {
    expect(contrast(scheme.outline, scheme.surface), greaterThanOrEqualTo(3));
  });

  testWidgets('기본 글꼴이 Pretendard다', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        home: const Scaffold(body: Text('빛')),
      ),
    );

    final style = DefaultTextStyle.of(tester.element(find.text('빛'))).style;
    expect(style.fontFamily, appFontFamily);
  });

  test('Pretendard 라이선스가 라이선스 페이지에 올라간다', () async {
    registerFontLicenses();

    final entries = await LicenseRegistry.licenses.toList();
    final pretendard = entries.where((e) => e.packages.contains('Pretendard'));
    expect(pretendard, isNotEmpty);
    expect(
      pretendard.first.paragraphs.map((p) => p.text).join(),
      contains('SIL Open Font License'),
    );
  });
}
