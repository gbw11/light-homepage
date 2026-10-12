import 'package:flutter/material.dart';

import '../../content/worship.dart';
import 'info_widgets.dart';

/// 예배와 모임 (웹 `/worship`, WIREFRAME §4, 기획안 §3).
///
/// 웹의 "그 외 모임"은 ❓(기도회 · 훈련과정 확인 필요)뿐이라 옮기지 않았다.
class WorshipScreen extends StatelessWidget {
  const WorshipScreen({
    super.key,
    required this.onDirections,
    required this.onFirstVisit,
  });

  final VoidCallback onDirections;
  final VoidCallback onFirstVisit;

  @override
  Widget build(BuildContext context) {
    return InfoPage(
      title: '예배와 모임',
      children: [
        const SizedBox(height: 8),
        Card(
          margin: EdgeInsets.zero,
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              for (final (i, row) in worshipSchedule.indexed) ...[
                if (i > 0) const Divider(height: 1),
                _ScheduleRow(row),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerLeft,
          child: FilledButton(
            onPressed: onDirections,
            child: const Text('오시는 길'),
          ),
        ),
        InfoSection(
          title: '마을모임',
          children: [
            const InfoText('1마을부터 9마을로 나뉘어 모입니다. 처음 오신 분은 새가족마을에서 함께 시작합니다.'),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton(
                onPressed: onFirstVisit,
                child: const Text('처음 오시는 분'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/// 이름 | 시각 · 장소. 모교회 예배 안내 표의 한 줄과 같은 뼈대다 (웹 주석)
class _ScheduleRow extends StatelessWidget {
  const _ScheduleRow(this.row);

  final ScheduleRow row;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Semantics(
      // 표처럼 읽히게 한 줄을 한 문장으로 묶는다
      label: '${row.name}, ${row.time}, ${row.place}',
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              flex: 2,
              child: Text(
                row.name,
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 3,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    row.time,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    row.place,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
