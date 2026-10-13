import 'package:flutter/material.dart';

import '../../content/location.dart';
import '../../content/welcome.dart';
import 'info_widgets.dart';

/// 처음 오시는 분 (웹 `/welcome`, WIREFRAME §2 "최우선 페이지", 기획안 §3).
///
/// 처음 오는 사람이 겁먹지 않게 — 어디로 오는지, 와서 무엇을 하는지, 무엇을
/// 묻고 싶어 하는지를 위에서부터 차례로 둔다. 순서와 문구는 웹과 같고, 모양은
/// 디자인 시안(Stitch "Warm Fellowship")을 따른다.
///
/// 웹에서 ❓(확인 필요)로 남은 것 — 입구 사진 · 새가족마을 운영 방식 · 버스 ·
/// 카카오톡 문의 — 은 앱에 옮기지 않았다. 앱 사용자에게 "확인 필요"를 보여줄
/// 이유가 없다. 웹의 약도 그림(SVG)도 아직 옮기지 않았다 — 대신 지도 앱으로 연다.
class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({
    super.key,
    required this.onDirections,
    required this.onRegister,
    required this.openExternal,
  });

  final VoidCallback onDirections;
  final VoidCallback onRegister;
  final void Function(String url) openExternal;

  @override
  Widget build(BuildContext context) {
    return InfoPage(
      title: '처음 오시는 분',
      children: [
        const SizedBox(height: 8),
        // 빨간 경고 상자(본당이 아니라 드림센터)는 오시는 길에만 둔다 —
        // 사용자 결정 2026-10-13. 여기서는 아래 「드림센터를 찾아오세요」가 말한다
        const _Intro(),
        InfoSection(
          title: '드림센터를 찾아오세요',
          children: [
            InfoCard(
              children: [
                const Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    IconBadge(Icons.directions_walk),
                    SizedBox(width: 14),
                    Expanded(
                      child: InfoText(
                        '본당 앞에서 도보 $walkMinutes분 (${walkMeters}m) — 남쪽으로 '
                        '내려가 초등학교 끝에서 오른쪽입니다.',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                // 큰 글씨에서는 한 줄에 둘이 못 들어간다 — 그때는 아래로 내려간다
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    FilledButton.icon(
                      onPressed: () => openExternal(kakaoMapUrl),
                      style: pillButtonStyle(context),
                      icon: const Icon(Icons.map_outlined, size: 20),
                      label: const Text('지도 앱으로 열기'),
                    ),
                    FilledButton.icon(
                      onPressed: onDirections,
                      style: pillButtonStyle(context, primary: false),
                      icon: const Icon(Icons.near_me_outlined, size: 20),
                      label: const Text('오시는 길 자세히'),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
        const InfoSection(
          title: '주일은 이렇게 흘러갑니다',
          children: [
            InfoCard(children: [_Timeline()]),
            SizedBox(height: 12),
            InfoText('예배만 참석하고 가셔도 괜찮아요.', muted: true),
          ],
        ),
        const InfoSection(
          title: '새가족마을',
          children: [
            InfoCard(
              children: [
                Row(
                  children: [
                    IconBadge(Icons.groups_outlined),
                    SizedBox(width: 14),
                    Expanded(child: InfoText('처음 오신 분들이 함께 모이는 마을이 따로 있습니다.')),
                  ],
                ),
              ],
            ),
          ],
        ),
        InfoSection(
          title: '주차',
          children: [
            // 주차 규칙 전문은 오시는 길에 있다. 여기서는 헛걸음을 막는 한 줄만
            SoftCard(
              child: InfoTile(
                icon: Icons.local_parking,
                title: '주차장별 이용 시간 보기',
                subtitle: '김해교회 주차장 세 곳을 함께 씁니다. 두 곳은 주일에만 주차할 수 있어요.',
                onTap: onDirections,
              ),
            ),
          ],
        ),
        const InfoSection(title: '자주 묻는 질문', children: [_Faq()]),
        const SizedBox(height: 36),
        _RegisterCard(onRegister: onRegister),
      ],
    );
  }
}

/// 맨 위 인사 — 옅은 초록 판
class _Intro extends StatelessWidget {
  const _Intro();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SoftCard(
      color: theme.colorScheme.primary.withValues(alpha: 0.08),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const TagPill('처음 오시는 분께'),
            const SizedBox(height: 12),
            Text(
              '혼자 오셔도 괜찮습니다.',
              style: theme.textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            const InfoText('편한 차림으로 오세요. 부담 없이 함께해요.', muted: true),
          ],
        ),
      ),
    );
  }
}

/// 주일 흐름 — 시각 알약 · 할 일. 청년예배 시각만 짙은 초록이다
class _Timeline extends StatelessWidget {
  const _Timeline();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 16,
      children: [
        for (final step in sundayTimeline)
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 시각 칸 너비를 맞춰 할 일이 한 줄로 서게 한다 — 큰 글씨면 늘어난다
              ConstrainedBox(
                constraints: const BoxConstraints(minWidth: 76),
                child: Align(
                  alignment: Alignment.centerLeft,
                  widthFactor: 1,
                  child: TagPill(step.time, strong: step.label == '청년예배'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    InfoText(step.label, bold: true),
                    if (step.detail case final detail?)
                      InfoText(detail, muted: true),
                  ],
                ),
              ),
            ],
          ),
      ],
    );
  }
}

/// 자주 묻는 질문 — 흰 판 하나에 Q 줄들. 누르면 답이 펼쳐진다
class _Faq extends StatelessWidget {
  const _Faq();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SoftCard(
      child: Column(
        children: [
          for (final (i, faq) in welcomeFaq.indexed) ...[
            if (i > 0)
              Divider(
                height: 1,
                indent: 16,
                endIndent: 16,
                color: theme.colorScheme.outlineVariant.withValues(alpha: 0.6),
              ),
            ExpansionTile(
              leading: ExcludeSemantics(
                child: Text(
                  'Q',
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: theme.colorScheme.primary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              minTileHeight: 56,
              title: Text(
                faq.question,
                style: theme.textTheme.bodyLarge?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              childrenPadding: const EdgeInsets.fromLTRB(56, 0, 16, 16),
              expandedAlignment: Alignment.centerLeft,
              shape: const Border(),
              collapsedShape: const Border(),
              children: [InfoText(faq.answer, muted: true)],
            ),
          ],
        ],
      ),
    );
  }
}

/// 맨 아래 — 짙은 초록 판에 새가족 등록
class _RegisterCard extends StatelessWidget {
  const _RegisterCard({required this.onRegister});

  final VoidCallback onRegister;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return SoftCard(
      color: scheme.primary,
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Semantics(
              header: true,
              child: Text(
                '미리 알려주시면 맞이하겠습니다',
                style: theme.textTheme.titleLarge?.copyWith(
                  color: scheme.onPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: onRegister,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
                shape: const StadiumBorder(),
                backgroundColor: scheme.surface,
                foregroundColor: scheme.primary,
                textStyle: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Flexible(child: Text('새가족 등록하기')),
                  SizedBox(width: 8),
                  Icon(Icons.arrow_forward, size: 20),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
