import 'package:flutter/material.dart';

import '../../content/contact.dart';
import '../../content/location.dart';
import '../../content/worship.dart';
import 'info_widgets.dart';

/// 문의하기 (웹 `/contact`, 기획안 §3 M11).
///
/// 번호를 버튼 안에 **글자로** 보인다 — 누르면 전화 앱이 열리고, 못 거는
/// 상황이면 눈으로 읽어 옮겨 적을 수 있다 (웹 주석과 같은 이유).
class ContactScreen extends StatelessWidget {
  const ContactScreen({
    super.key,
    required this.openExternal,
    required this.onFirstVisit,
    required this.onDirections,
  });

  final void Function(String url) openExternal;
  final VoidCallback onFirstVisit;
  final VoidCallback onDirections;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final label = theme.textTheme.labelLarge?.copyWith(
      color: theme.colorScheme.onSurfaceVariant,
      fontWeight: FontWeight.w700,
    );
    return InfoPage(
      title: '문의하기',
      children: [
        const SizedBox(height: 8),
        const InfoText('궁금한 점이 있으면 편하게 연락 주세요.', muted: true),
        const SizedBox(height: 16),
        InfoCard(
          children: [
            Text('전화', style: label),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: () => openExternal('tel:$churchPhoneTel'),
              icon: const Icon(Icons.call),
              label: const Text(churchPhone),
            ),
            const SizedBox(height: 12),
            // ⚠️ 청년부 직통이 아니라 교회 사무실이다. 적지 않으면 건 사람이 당황한다
            const InfoText(
              '김해교회 사무실로 연결됩니다. 청년교회 담당자를 찾으신다고 말씀해 '
              '주세요. 평일 낮에 연락하시면 가장 빠릅니다.',
              muted: true,
            ),
          ],
        ),
        const SizedBox(height: 16),
        InfoCard(
          children: [
            Text('직접 찾아오시려면', style: label),
            const SizedBox(height: 12),
            InfoText('$sundayWorshipTime · $venue', bold: true),
            const SizedBox(height: 4),
            const InfoText(
              '드림센터는 본당과 별개 건물입니다. 처음이시면 길찾기 안내를 먼저 '
              '보시는 편이 빠릅니다.',
              muted: true,
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                OutlinedButton(
                  onPressed: onFirstVisit,
                  child: const Text('처음 오시는 분'),
                ),
                OutlinedButton(
                  onPressed: onDirections,
                  child: const Text('오시는 길'),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }
}
