import 'package:flutter/material.dart';

import '../../content/organization.dart';
import 'info_widgets.dart';

/// 조직도 (웹 `/about/organization`, LIGHT-300).
///
/// 웹과 같은 세 묶음 — 임원단 · 마을(9개) · 팀. 웹의 4칸 · 3칸 격자는 폰 폭에
/// 맞춰 임원단은 2열, 마을과 팀은 한 줄에 하나씩 내린다.
///
/// 이름 · 명단은 아직 웹도 ❓(확인 필요)다. 다른 교회 안내 화면은 ❓ 항목을 빼고
/// 옮겼지만, 조직도는 PM 결정(2026-09-10)대로 자리표시를 **그대로 보인다** —
/// 틀이 곧 내용이라 빼면 화면이 비고, 마지막에 값만 채우면 된다
/// (`content/organization.dart`).
class OrganizationScreen extends StatelessWidget {
  const OrganizationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const InfoPage(
      title: '조직도',
      children: [
        SizedBox(height: 8),
        InfoText(
          '임원단, 마을, 팀으로 구성됩니다. 마을은 모든 회원이 필수로 소속되고, '
          '팀은 지원제로 운영됩니다.',
          muted: true,
        ),
        InfoSection(title: '임원단', children: [_OfficerGrid()]),
        InfoSection(
          title: '마을 ($villageCount개)',
          children: [
            InfoText(
              '모든 회원은 마을에 필수로 소속됩니다 (1인 1마을). '
              '각 마을은 촌장 1명과 마을원으로 구성됩니다.',
              muted: true,
            ),
            SizedBox(height: 16),
            _VillageList(),
          ],
        ),
        InfoSection(
          title: '팀',
          children: [
            InfoText(
              '팀은 지원자를 받아 운영하며, 마을 소속과 별개입니다. '
              '각 팀은 팀장·총무·회계·팀원으로 구성됩니다.',
              muted: true,
            ),
            SizedBox(height: 16),
            _TeamList(),
          ],
        ),
      ],
    );
  }
}

/// 임원 4명 — 2열. 칸 높이를 글자 크기에 맡기려고 GridView 대신 줄을 쌓는다
/// (고정 비율 격자는 글자를 키우면 넘친다)
class _OfficerGrid extends StatelessWidget {
  const _OfficerGrid();

  @override
  Widget build(BuildContext context) {
    const gap = 12.0;
    return Column(
      children: [
        for (var row = 0; row < officerCount; row += 2) ...[
          if (row > 0) const SizedBox(height: gap),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: _OfficerCard(number: row + 1)),
                const SizedBox(width: gap),
                Expanded(
                  child: row + 1 < officerCount
                      ? _OfficerCard(number: row + 2)
                      : const SizedBox.shrink(),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

/// 임원 한 칸 — 사진 자리(❓) · "임원 n" · 직분(❓)
class _OfficerCard extends StatelessWidget {
  const _OfficerCard({required this.number});

  final int number;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return SoftCard(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 사진 자리 — 웹과 같은 VANILLA 바탕의 정사각형
            AspectRatio(
              aspectRatio: 1,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: scheme.outlineVariant,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Text(
                    '❓',
                    semanticsLabel: '사진 확인 필요',
                    style: theme.textTheme.titleLarge,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              '임원 $number',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              unknownLabel,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: scheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 마을 9개 — 한 줄에 하나. 이름 · 촌장 · 마을원 수
class _VillageList extends StatelessWidget {
  const _VillageList();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodyMedium?.copyWith(
      color: theme.colorScheme.onSurfaceVariant,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 1; i <= villageCount; i++) ...[
          if (i > 1) const SizedBox(height: 10),
          SoftCard(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  const IconBadge(Icons.cottage_outlined),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '마을 $i',
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text('촌장: $unknownLabel', style: muted),
                        Text('마을원: ❓명', style: muted),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// 팀 6개 — 한 줄에 하나. 팀 이름 아래 팀장 · 총무 · 회계 · 팀원
class _TeamList extends StatelessWidget {
  const _TeamList();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodyMedium?.copyWith(
      color: theme.colorScheme.onSurfaceVariant,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (i, team) in teams.indexed) ...[
          if (i > 0) const SizedBox(height: 10),
          InfoCard(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            children: [
              Row(
                children: [
                  const IconBadge(Icons.groups_outlined, size: 36),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      team,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              for (final role in teamRoles)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text('$role: $unknownLabel', style: muted),
                ),
            ],
          ),
        ],
      ],
    );
  }
}
