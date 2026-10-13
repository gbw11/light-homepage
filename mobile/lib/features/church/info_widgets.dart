import 'package:flutter/material.dart';

import '../../content/location.dart';

// 교회 안내 화면들(처음 오시는 분 · 오시는 길 · 예배와 모임 · 소개 · 문의)이 같이
// 쓰는 조각. 사이드바(☰)에서 열리는 정적 화면이라 모양을 한 벌로 맞춘다.
//
// 모양은 디자인 시안(Stitch "Warm Fellowship", 2026-10-13)을 따른다 —
// 제목 앞 초록 막대 · 흰 카드(가는 테두리 · 옅은 그림자 · 18px 둥근 모서리) ·
// 동그란 아이콘 · 알약 모양 딱지와 버튼.

/// 제목 막대 + 세로로 내리는 본문
class InfoPage extends StatelessWidget {
  const InfoPage({super.key, required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 48),
        children: children,
      ),
    );
  }
}

/// ▌소제목이 붙은 묶음 (홈의 칸 제목과 같은 막대)
class InfoSection extends StatelessWidget {
  const InfoSection({super.key, required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 36),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Container(
                    width: 6,
                    height: 20,
                    decoration: BoxDecoration(
                      color: theme.colorScheme.primary,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    title,
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          ...children,
        ],
      ),
    );
  }
}

/// 본문 문단. [muted]면 보조 글자색
class InfoText extends StatelessWidget {
  const InfoText(this.text, {super.key, this.muted = false, this.bold = false});

  final String text;
  final bool muted;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Text(
      text,
      style: theme.textTheme.bodyLarge?.copyWith(
        height: 1.6,
        color: muted ? theme.colorScheme.onSurfaceVariant : null,
        fontWeight: bold ? FontWeight.w700 : null,
      ),
    );
  }
}

/// 빨간 테두리 경고 상자 (앞에 ⚠ 아이콘).
///
/// 웹과 같은 이유로 **글자는 기본 색**으로 둔다 — 빨간 글자를 옅은 빨강 바탕에
/// 올리면 대비가 WCAG AA(4.5:1)에 못 미친다 (웹 `welcome/page.tsx` 주석).
/// 경고 신호는 테두리 · 바탕 · 아이콘이 진다.
class WarningBox extends StatelessWidget {
  const WarningBox({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final error = Theme.of(context).colorScheme.error;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: error.withValues(alpha: 0.06),
        border: Border.all(color: error.withValues(alpha: 0.7)),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.warning_amber_rounded, color: error, size: 22),
            const SizedBox(width: 10),
            Expanded(child: child),
          ],
        ),
      ),
    );
  }
}

/// "본당이 아니라 드림센터 4층" — 이 앱에서 가장 자주 놓치는 정보라 오시는 길
/// 맨 위에 둔다. 웹은 처음 오시는 분에도 두지만 앱은 뺐다 (사용자 결정 2026-10-13)
class VenueWarning extends StatelessWidget {
  const VenueWarning({super.key});

  @override
  Widget build(BuildContext context) {
    return WarningBox(
      child: Text.rich(
        const TextSpan(
          children: [
            TextSpan(text: '청년예배는 본당이 아니라 '),
            TextSpan(
              text: venue,
              style: TextStyle(decoration: TextDecoration.underline),
            ),
            TextSpan(text: '입니다.'),
          ],
        ),
        style: Theme.of(context).textTheme.bodyLarge
            ?.copyWith(fontWeight: FontWeight.w700, height: 1.5),
      ),
    );
  }
}

/// 흰 카드 — 가는 테두리 · 옅은 그림자. 주차장 · 연락처처럼 같은 모양이 여럿
/// 늘어설 때, 또는 한 덩어리 설명을 묶을 때
class InfoCard extends StatelessWidget {
  const InfoCard({
    super.key,
    required this.children,
    this.padding = const EdgeInsets.all(20),
  });

  final List<Widget> children;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return SoftCard(
      child: Padding(
        padding: padding,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: children,
        ),
      ),
    );
  }
}

/// 흰 판 자체 — 안을 직접 채울 때 ([InfoTile] 목록 등)
class SoftCard extends StatelessWidget {
  const SoftCard({super.key, required this.child, this.color});

  final Widget child;

  /// 없으면 흰색. 정한 색 토큰(AppColors)에 흰색이 따로 없어 `onPrimary`(흰색)를 쓴다
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: color ?? scheme.onPrimary,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: scheme.outlineVariant.withValues(alpha: 0.7)),
        boxShadow: [
          BoxShadow(
            color: scheme.onSurface.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ClipRRect(borderRadius: BorderRadius.circular(18), child: child),
    );
  }
}

/// 동그란 아이콘 — 옅은 초록 바탕
class IconBadge extends StatelessWidget {
  const IconBadge(this.icon, {super.key, this.size = 44});

  final IconData icon;
  final double size;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: scheme.primary.withValues(alpha: 0.12),
        shape: BoxShape.circle,
      ),
      child: Icon(icon, color: scheme.primary, size: size * 0.5),
    );
  }
}

/// 알약 모양 딱지 — 「도보 2분」 · 「주일만」 같은 짧은 표시.
/// [strong]이면 짙은 초록 바탕에 흰 글자 (가장 중요한 하나에만)
class TagPill extends StatelessWidget {
  const TagPill(this.text, {super.key, this.strong = false});

  final String text;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: strong ? scheme.primary : scheme.primary.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        child: Text(
          text,
          style: theme.textTheme.labelLarge?.copyWith(
            color: strong ? scheme.onPrimary : scheme.primary,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

/// 동그란 아이콘 · 제목 · 한 줄 설명 · › — 누르면 다른 화면으로 가는 줄
class InfoTile extends StatelessWidget {
  const InfoTile({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: onTap,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 64),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              IconBadge(icon),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (subtitle case final subtitle?)
                      Text(
                        subtitle,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(
                Icons.chevron_right,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 끝이 둥근 버튼 한 쌍에 쓰는 모양 — [primary]는 짙은 초록, 아니면 옅은 초록
ButtonStyle pillButtonStyle(BuildContext context, {bool primary = true}) {
  final scheme = Theme.of(context).colorScheme;
  return FilledButton.styleFrom(
    minimumSize: const Size(0, 50),
    shape: const StadiumBorder(),
    backgroundColor: primary
        ? scheme.primary
        : scheme.primary.withValues(alpha: 0.12),
    foregroundColor: primary ? scheme.onPrimary : scheme.primary,
    textStyle: Theme.of(context).textTheme.titleSmall
        ?.copyWith(fontWeight: FontWeight.w700),
  );
}

/// 「▸ 더 보기」 같은 글자 링크
class InfoLink extends StatelessWidget {
  const InfoLink(this.label, {super.key, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: TextButton(
        onPressed: onPressed,
        style: TextButton.styleFrom(
          padding: EdgeInsets.zero,
          minimumSize: const Size(0, 48),
          alignment: Alignment.centerLeft,
        ),
        child: Text('▸ $label'),
      ),
    );
  }
}
