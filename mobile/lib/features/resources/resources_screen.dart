import 'package:flutter/material.dart';

import '../../core/auth/auth_state.dart';
import '../../core/format/date_format.dart';
import '../../core/ui/menu_button.dart';
import '../../core/ui/profile_button.dart';
import '../account/login_gate.dart';
import '../meetings/meeting.dart';
import '../meetings/meetings_api.dart';

/// 자료 탭이 여는 곳
enum Resource { bulletins, photos, meetings, minutes, budget }

/// 자료 탭 — 회원 전용 자료의 입구 (기획안 §2-3 ① M6).
///
/// 비로그인은 무엇이 있는지만 알리고 [로그인]으로 보낸다. 로그인하면 카드 4개,
/// 임원 이상은 예산안 카드가 더해진다 (기획안 §5). 올리기는 각 자료 화면 안에 있다.
/// 월례회 카드에는 열람 기간이면 "열람 중 · ~마감"을 단다 — 기간이 짧아
/// 가장 놓치기 쉬운 자료다.
class ResourcesScreen extends StatefulWidget {
  const ResourcesScreen({
    super.key,
    required this.meetings,
    required this.onLogin,
    required this.onOpen,
  });

  final MeetingsApi meetings;
  final VoidCallback onLogin;
  final void Function(Resource resource) onOpen;

  @override
  State<ResourcesScreen> createState() => _ResourcesScreenState();
}

class _ResourcesScreenState extends State<ResourcesScreen> {
  /// 지금 열람 중인 월례회. 없거나 못 받아 오면 null — 표시만 빠진다
  MeetingSummary? _openMeeting;
  String? _loadedFor;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // 로그인한 사람이 바뀌면(로그인 · 로그아웃) 다시 묻는다
    final userId = AuthScope.of(context).user?.id;
    if (userId != _loadedFor) {
      _loadedFor = userId;
      _openMeeting = null;
      if (userId != null) _loadOpenMeeting();
    }
  }

  Future<void> _loadOpenMeeting() async {
    try {
      // 최신순이라 열람 중인 자료는 앞쪽에 있다
      final page = await widget.meetings.list(size: 5);
      final open = page.items
          .where((m) => m.status == MeetingStatus.open)
          .firstOrNull;
      if (mounted) setState(() => _openMeeting = open);
    } catch (_) {
      // 표시 하나 때문에 화면에 오류를 띄우지 않는다
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = AuthScope.of(context).user;
    return Scaffold(
      appBar: AppBar(
        leading: const MenuButton(),
        actions: const [ProfileButton()],
        title: const Text('자료', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: user == null
          ? LoginGate(
              onLogin: widget.onLogin,
              message: '회원 전용 자료입니다.\n로그인하면 열람 가능합니다.',
            )
          : RefreshIndicator(
              onRefresh: _loadOpenMeeting,
              child: _Hub(
                isLeader: user.role.isLeader,
                openMeeting: _openMeeting,
                onOpen: widget.onOpen,
              ),
            ),
    );
  }
}

class _Hub extends StatelessWidget {
  const _Hub({
    required this.isLeader,
    required this.openMeeting,
    required this.onOpen,
  });

  final bool isLeader;
  final MeetingSummary? openMeeting;
  final void Function(Resource resource) onOpen;

  @override
  Widget build(BuildContext context) {
    final meeting = openMeeting;
    final cards = [
      _ResourceCard(
        icon: Icons.menu_book_outlined,
        title: '주보',
        subtitle: '예배 순서와 이번 주 광고',
        onTap: () => onOpen(Resource.bulletins),
      ),
      _ResourceCard(
        icon: Icons.photo_library_outlined,
        title: '사진첩',
        subtitle: '모임과 행사 사진',
        onTap: () => onOpen(Resource.photos),
      ),
      _ResourceCard(
        icon: Icons.description_outlined,
        title: '월례회 자료',
        subtitle: '열람 기간에만 볼 수 있어요',
        badge: meeting == null
            ? null
            : '열람 중 · ~${formatMonthDayTime(meeting.viewableUntil)}',
        onTap: () => onOpen(Resource.meetings),
      ),
      _ResourceCard(
        icon: Icons.edit_note_outlined,
        title: '회의록',
        subtitle: '회의에서 정한 것',
        onTap: () => onOpen(Resource.minutes),
      ),
      if (isLeader)
        _ResourceCard(
          icon: Icons.account_balance_wallet_outlined,
          title: '예산안',
          subtitle: '임원 이상',
          onTap: () => onOpen(Resource.budget),
        ),
    ];

    // 한 줄에 하나씩 세로로 (사용자 결정 2026-10-13). 올리기는 각 자료 화면 안에
    // 있다 — 「관리는 웹에서」 링크는 뺐다
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      itemCount: cards.length,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (_, i) => cards[i],
    );
  }
}

/// 자료 한 줄 — 동그란 아이콘 · 이름 · 설명 · (열람 중 표시) · ›
class _ResourceCard extends StatelessWidget {
  const _ResourceCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.badge,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Material(
      // 정한 색 토큰에 흰색이 따로 없어 onPrimary(흰색)를 쓴다
      color: scheme.onPrimary,
      borderRadius: BorderRadius.circular(18),
      elevation: 0.5,
      shadowColor: scheme.onSurface.withValues(alpha: 0.2),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 12, 16),
          child: Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: scheme.primary.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 26, color: scheme.primary),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                    if (badge case final badge?) ...[
                      const SizedBox(height: 6),
                      DecoratedBox(
                        decoration: BoxDecoration(
                          color: scheme.primary,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 3,
                          ),
                          child: Text(
                            badge,
                            style: theme.textTheme.labelMedium?.copyWith(
                              color: scheme.onPrimary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(Icons.chevron_right, color: scheme.onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }
}
