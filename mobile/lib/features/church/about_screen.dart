import 'package:flutter/material.dart';

import 'info_widgets.dart';

/// 청년교회 소개 (웹 `/about`, WIREFRAME §3, 기획안 §3 M11).
///
/// 이름 LIGHT가 곧 비전이다 — **L**ive **I**n **G**od, **H**elp **T**he other.
/// 웹처럼 머리글자를 세우고 두 축을 차례로 푼다.
///
/// 웹의 「섬기는 사람들」·「한 해의 흐름」은 아직 모두 ❓(확인 필요)라 옮기지
/// 않았다. 공동체 사진도 웹이 빈 자리라 넣지 않았다 — 공개 화면 사진은 얼굴이
/// 식별되지 않는 것만 쓴다 (DECISIONS "수련회 실사진 공개 페이지 적용 범위").
class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InfoPage(
      title: '청년교회 소개',
      children: [
        const SizedBox(height: 8),
        Text(
          'LIGHT',
          style: theme.textTheme.labelLarge?.copyWith(
            color: theme.colorScheme.primary,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Live In God, Help The other',
          style: theme.textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 24),
        const _Acrostic(),
        InfoSection(
          title: 'Live In God',
          children: [
            const InfoText('하나님 안에 사는 것 — 예배와 말씀으로 세워집니다.'),
            const SizedBox(height: 16),
            // 홈 맨 위와 같은 사진 — 웹 공개용으로 고른, 얼굴이 보이지 않는 사진이다
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: Image.asset(
                  'assets/images/worship-hero.webp',
                  fit: BoxFit.cover,
                  semanticLabel: '어두운 예배 공간에서 손을 들어 찬양하는 청년들의 실루엣',
                ),
              ),
            ),
          ],
        ),
        const InfoSection(
          title: 'Help The other',
          children: [InfoText('이웃을 돕는 것 — 마을과 섬김으로 함께합니다.')],
        ),
      ],
    );
  }
}

/// L · I · G · H · T 머리글자와 그 뜻
class _Acrostic extends StatelessWidget {
  const _Acrostic();

  static const _words = [
    ('L', 'ive'),
    ('I', 'n'),
    ('G', 'od'),
    ('H', 'elp'),
    ('T', 'he other'),
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final letter = theme.textTheme.displaySmall?.copyWith(
      color: theme.colorScheme.primary,
      fontWeight: FontWeight.w700,
    );
    final rest = theme.textTheme.titleLarge?.copyWith(
      color: theme.colorScheme.onSurfaceVariant,
    );
    return Semantics(
      label: 'Live In God, Help The other',
      excludeSemantics: true,
      child: Card(
        margin: EdgeInsets.zero,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final (head, tail) in _words)
                Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(text: head, style: letter),
                      TextSpan(text: tail, style: rest),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
