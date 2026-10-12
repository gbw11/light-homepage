import 'package:flutter/material.dart';

import '../../content/location.dart';

// 교회 안내 화면들(처음 오시는 분 · 오시는 길 · 예배와 모임 · 소개 · 문의)이 같이
// 쓰는 조각. 사이드바(☰)에서 열리는 정적 화면이라 모양을 한 벌로 맞춘다.

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
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
        children: children,
      ),
    );
  }
}

/// 소제목이 붙은 묶음
class InfoSection extends StatelessWidget {
  const InfoSection({super.key, required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: Text(
              title,
              style: Theme.of(context).textTheme.titleLarge
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(height: 12),
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
        height: 1.5,
        color: muted ? theme.colorScheme.onSurfaceVariant : null,
        fontWeight: bold ? FontWeight.w700 : null,
      ),
    );
  }
}

/// 빨간 테두리 경고 상자.
///
/// 웹과 같은 이유로 **글자는 기본 색**으로 둔다 — 빨간 글자를 옅은 빨강 바탕에
/// 올리면 대비가 WCAG AA(4.5:1)에 못 미친다 (웹 `welcome/page.tsx` 주석).
/// 경고 신호는 테두리와 바탕이 진다.
class WarningBox extends StatelessWidget {
  const WarningBox({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final error = Theme.of(context).colorScheme.error;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: error.withValues(alpha: 0.08),
        border: Border.all(color: error),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(padding: const EdgeInsets.all(16), child: child),
    );
  }
}

/// "본당이 아니라 드림센터 4층" — 이 앱에서 가장 자주 놓치는 정보라 처음 오시는
/// 분 · 오시는 길 두 화면 모두 맨 위에 둔다 (웹과 같다)
class VenueWarning extends StatelessWidget {
  const VenueWarning({super.key});

  @override
  Widget build(BuildContext context) {
    return WarningBox(
      child: Text.rich(
        const TextSpan(
          children: [
            TextSpan(text: '⚠️ 청년예배는 본당이 아니라 '),
            TextSpan(
              text: venue,
              style: TextStyle(decoration: TextDecoration.underline),
            ),
            TextSpan(text: '입니다.'),
          ],
        ),
        style: Theme.of(context).textTheme.bodyLarge
            ?.copyWith(fontWeight: FontWeight.w700),
      ),
    );
  }
}

/// 테두리만 있는 카드 — 주차장 · 연락처처럼 같은 모양이 여럿 늘어설 때
class InfoCard extends StatelessWidget {
  const InfoCard({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: children,
        ),
      ),
    );
  }
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
        style: TextButton.styleFrom(padding: EdgeInsets.zero),
        child: Text('▸ $label'),
      ),
    );
  }
}
