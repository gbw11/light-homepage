import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app_colors.dart';

/// 한글·영문 공통 글꼴. `pubspec.yaml`의 `fonts:`에 등록한 이름과 같아야 한다
const appFontFamily = 'Pretendard';

/// 앱 전체 테마 (라이트만 — 다크 모드는 아직 정하지 않았다).
///
/// 정해진 색([AppColors])은 직접 넣고, 나머지 역할(`primaryContainer` 등)은
/// [AppColors.primary]를 씨앗으로 Material 3가 만든 값을 쓴다.
ThemeData buildAppTheme() {
  final colorScheme = ColorScheme.fromSeed(seedColor: AppColors.primary)
      .copyWith(
        primary: AppColors.primary,
        onPrimary: AppColors.onPrimary,
        surface: AppColors.surface,
        onSurface: AppColors.onSurface,
        onSurfaceVariant: AppColors.onSurfaceVariant,
        outline: AppColors.outline,
        outlineVariant: AppColors.outlineVariant,
        error: AppColors.error,
        onError: AppColors.onError,
        // 정한 컨테이너 색은 하나다. 단계(Low·High…)를 지어내지 않고 모두 같은
        // 값으로 둔다 — 씨앗에서 만든 값은 초록빛 회색이라 크림 배경과 겉돈다.
        // 카드·바텀시트(Low), 탭 바(기본), 다이얼로그(High), 입력란(Highest)이
        // 각각 다른 단계를 쓰므로 하나라도 비우면 그 컴포넌트만 색이 튄다.
        surfaceContainerLowest: AppColors.surface,
        surfaceContainerLow: AppColors.surfaceContainer,
        surfaceContainer: AppColors.surfaceContainer,
        surfaceContainerHigh: AppColors.surfaceContainer,
        surfaceContainerHighest: AppColors.surfaceContainer,
      );

  return ThemeData(colorScheme: colorScheme, fontFamily: appFontFamily);
}

/// Pretendard 라이선스(SIL OFL 1.1)를 앱의 라이선스 페이지에 올린다.
///
/// OFL은 글꼴을 배포할 때 라이선스를 함께 넣으라고 요구한다. 파일을 번들하는
/// 것만으로는 사용자가 볼 수 없으므로 `showLicensePage`에 나오게 등록한다.
void registerFontLicenses() {
  LicenseRegistry.addLicense(() async* {
    final text = await rootBundle.loadString(
      'assets/fonts/pretendard/LICENSE.txt',
    );
    yield LicenseEntryWithLineBreaks(const ['Pretendard'], text);
  });
}
