import 'package:flutter/material.dart';

import '../../core/auth/auth_state.dart';
import '../../core/config.dart';
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
/// 임원 이상은 예산안 카드와 "관리는 웹에서"가 더해진다 (기획안 §5).
/// 월례회 카드에는 열람 기간이면 "열람 중 · ~마감"을 단다 — 기간이 짧아
/// 가장 놓치기 쉬운 자료다.
class ResourcesScreen extends StatefulWidget {
  const ResourcesScreen({
    super.key,
    required this.meetings,
    required this.onLogin,
    required this.onOpen,
    required this.openExternal,
  });

  final MeetingsApi meetings;
  final VoidCallback onLogin;
  final void Function(Resource resource) onOpen;
  final void Function(String url) openExternal;

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
              message: '회원 전용 자료예요.\n주보 · 사진첩 · 월례회 자료 · 회의록은\n로그인하면 볼 수 있어요.',
            )
          : RefreshIndicator(
              onRefresh: _loadOpenMeeting,
              child: _Hub(
                isLeader: user.role.isLeader,
                openMeeting: _openMeeting,
                onOpen: widget.onOpen,
                openExternal: widget.openExternal,
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
    required this.openExternal,
  });

  final bool isLeader;
  final MeetingSummary? openMeeting;
  final void Function(Resource resource) onOpen;
  final void Function(String url) openExternal;

  @override
  Widget build(BuildContext context) {
    final adminUrl = webUrl('/admin');
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

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        // 두 장씩 한 줄. 글자를 키워도 잘리지 않게 칸 높이를 내용에 맞춘다
        for (var i = 0; i < cards.length; i += 2)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(child: cards[i]),
                  const SizedBox(width: 12),
                  Expanded(
                    child: i + 1 < cards.length
                        ? cards[i + 1]
                        : const SizedBox.shrink(),
                  ),
                ],
              ),
            ),
          ),
        // 관리 기능은 앱에 만들지 않는다 — 임원에게 웹으로 가는 길만 (기획안 §1)
        if (isLeader && adminUrl != null)
          Align(
            child: TextButton(
              onPressed: () => openExternal(adminUrl),
              child: const Text('관리는 웹에서 →'),
            ),
          ),
      ],
    );
  }
}

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
    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 32, color: scheme.primary),
              const SizedBox(height: 12),
              Text(
                title,
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
              ),
              if (badge case final badge?) ...[
                const SizedBox(height: 8),
                DecoratedBox(
                  decoration: BoxDecoration(
                    color: scheme.primary,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 2,
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
      ),
    );
  }
}
