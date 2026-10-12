import 'package:flutter/material.dart';

import '../../content/location.dart';
import '../../content/welcome.dart';
import 'info_widgets.dart';

/// 처음 오시는 분 (웹 `/welcome`, WIREFRAME §2 "최우선 페이지", 기획안 §3).
///
/// 처음 오는 사람이 겁먹지 않게 — 어디로 오는지, 와서 무엇을 하는지, 무엇을
/// 묻고 싶어 하는지를 위에서부터 차례로 둔다. 순서와 문구는 웹과 같다.
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
    final theme = Theme.of(context);
    return InfoPage(
      title: '처음 오시는 분',
      children: [
        const SizedBox(height: 8),
        Text(
          '처음 오시는 분께',
          style: theme.textTheme.labelLarge?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          '혼자 오셔도 괜찮습니다.',
          style: theme.textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        InfoSection(
          title: '① 드림센터를 찾아오세요',
          children: [
            const VenueWarning(),
            const SizedBox(height: 16),
            const InfoText(
              '본당 앞에서 도보 $walkMinutes분 (${walkMeters}m) — 남쪽으로 내려가 '
              '초등학교 끝에서 오른쪽입니다.',
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton.icon(
                  onPressed: () => openExternal(kakaoMapUrl),
                  icon: const Icon(Icons.map_outlined),
                  label: const Text('지도 앱으로 열기'),
                ),
                OutlinedButton(
                  onPressed: onDirections,
                  child: const Text('오시는 길 자세히'),
                ),
              ],
            ),
          ],
        ),
        InfoSection(
          title: '② 주일은 이렇게 흘러갑니다',
          children: [
            const _Timeline(),
            const SizedBox(height: 16),
            const InfoText('예배만 참석하고 가셔도 괜찮아요.'),
          ],
        ),
        const InfoSection(
          title: '③ 새가족마을',
          children: [InfoText('처음 오신 분들이 함께 모이는 마을이 따로 있습니다.')],
        ),
        InfoSection(
          title: '주차',
          children: [
            // 주차 규칙 전문은 오시는 길에 있다. 여기서는 헛걸음을 막는 한 줄만
            const InfoText('김해교회 주차장 세 곳을 함께 씁니다. 세 곳 중 두 곳은 주일에만 주차할 수 있습니다.'),
            InfoLink('주차장별 이용 시간 보기', onPressed: onDirections),
          ],
        ),
        InfoSection(
          title: '자주 묻는 질문',
          children: [
            for (final faq in welcomeFaq)
              ExpansionTile(
                title: Text(faq.question),
                tilePadding: EdgeInsets.zero,
                childrenPadding: const EdgeInsets.only(bottom: 12),
                expandedAlignment: Alignment.centerLeft,
                shape: const Border(),
                collapsedShape: const Border(),
                children: [InfoText(faq.answer, muted: true)],
              ),
          ],
        ),
        InfoSection(
          title: '미리 알려주시면 맞이하겠습니다',
          children: [
            FilledButton(onPressed: onRegister, child: const Text('새가족 등록하기')),
          ],
        ),
      ],
    );
  }
}

/// 주일 흐름 — 왼쪽 세로줄에 시각을 차례로 단다
class _Timeline extends StatelessWidget {
  const _Timeline();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border(
          left: BorderSide(color: theme.colorScheme.outlineVariant, width: 2),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.only(left: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 16,
          children: [
            for (final step in sundayTimeline)
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  InfoText('${step.time} · ${step.label}', bold: true),
                  if (step.detail case final detail?)
                    InfoText(detail, muted: true),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
