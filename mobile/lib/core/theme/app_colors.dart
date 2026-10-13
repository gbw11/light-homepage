import 'package:flutter/painting.dart';

/// 앱 색 토큰 (2026-10-07 결정).
///
/// 웹(`frontend/src/app/globals.css`)은 STUDIO FLEUR 팔레트의 아몬드 배경을 쓰고,
/// 앱은 그보다 밝은 **웜 크림** 배경을 쓴다. 대신 버튼색과 글자색은 웹과 같은
/// 값이라 두 화면이 같은 서비스로 보인다 — 각 값의 웹 토큰을 주석에 적었다.
///
/// 화면 코드는 이 값을 직접 쓰지 않고 `Theme.of(context).colorScheme`으로 꺼낸다.
abstract final class AppColors {
  /// 배경 — 웜 크림
  static const surface = Color(0xFFFEF9F0);

  /// 카드·입력란·하단 탭 바
  static const surfaceContainer = Color(0xFFF8F3EB);

  /// 주요 버튼·선택된 탭 — **엠블럼(logo.png)의 초록** (2026-10-13 사용자 결정).
  ///
  /// 처음에는 웹 CTA(`--color-yellow`, 올리브 #57674D)와 같은 값이었는데, 엠블럼
  /// 옆에 두니 색이 달라 보여 엠블럼에 맞췄다 — **이제 웹과 다르다.**
  /// 엠블럼 띠에 가장 많은 초록(#408838)은 흰 글자 대비가 4.4:1로 WCAG AA(4.5:1)에
  /// 조금 못 미쳐, 같은 띠의 한 단계 짙은 초록을 쓴다 (흰 글자 5.2:1)
  static const primary = Color(0xFF3A7A33);
  static const onPrimary = Color(0xFFFFFFFF);

  /// 본문 — 딥 브라운 (웹 `--color-ink`)
  static const onSurface = Color(0xFF322819);

  /// 보조 텍스트 — 날짜·설명 (웹 `--color-gray-400`)
  static const onSurfaceVariant = Color(0xFF5D5447);

  /// 테두리 버튼·입력란 테두리 — CAROB (웹 `--color-navy-800`)
  static const outline = Color(0xFF725C3A);

  /// 구분선·카드 테두리 — VANILLA (웹 `--color-navy-100`)
  static const outlineVariant = Color(0xFFE5D2B8);

  /// 경고 — "본당이 아니라 드림센터 4층" 안내에 쓴다 (웹 `--color-red-500`)
  static const error = Color(0xFFBB282B);
  static const onError = Color(0xFFFFFFFF);
}
