import 'package:flutter/material.dart';

import '../../core/format/date_format.dart';
import '../../core/ui/status_views.dart';
import 'inbox.dart';

/// 알림함 — 홈의 종 아이콘으로 연다.
///
/// 열 때 한 번 새로 받고, **연 순간의 목록을 그대로 보여주면서** 모두 읽음으로
/// 바꾼다 — 그래서 이번에 새로 온 것에는 점이 남아 있고, 종의 숫자는 0이 된다.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({
    super.key,
    required this.inbox,
    required this.onOpen,
  });

  final NotificationInbox inbox;

  /// 누를 화면은 바깥(라우터)이 정한다
  final void Function(InboxItem item) onOpen;

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  /// 읽음으로 바꾸기 전의 목록 — 무엇이 새것이었는지 보여준다
  List<InboxItem>? _items;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    await widget.inbox.refresh();
    if (!mounted) return;
    setState(() => _items = widget.inbox.items);
    await widget.inbox.markAllRead();
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    return Scaffold(
      appBar: AppBar(title: const Text('알림')),
      body: switch (items) {
        null => const LoadingView(),
        [] => RefreshIndicator(
          onRefresh: _load,
          // 당겨서 새로 고칠 수 있게 스크롤되는 판에 얹는다
          child: ListView(
            children: const [
              MessageView(
                message: '최근 30일 동안 새 소식이 없어요.',
                icon: Icons.notifications_none_rounded,
              ),
            ],
          ),
        ),
        _ => RefreshIndicator(
          onRefresh: _load,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: items.length,
            separatorBuilder: (_, _) => const Divider(height: 1, indent: 72),
            itemBuilder: (context, i) =>
                _InboxTile(items[i], onTap: () => widget.onOpen(items[i])),
          ),
        ),
      },
    );
  }
}

class _InboxTile extends StatelessWidget {
  const _InboxTile(this.item, {required this.onTap});

  final InboxItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final (icon, label) = switch (item.kind) {
      // 공개 · 회원 공지 모두 「공지」다 — 회원 전용 딱지는 달지 않는다 (DECISIONS 09-16)
      InboxKind.notice ||
      InboxKind.memberNotice => (Icons.campaign_outlined, '공지'),
      InboxKind.bulletin => (Icons.menu_book_outlined, '주보'),
      InboxKind.newcomer => (Icons.person_add_alt_outlined, '새가족 신청'),
    };
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      leading: CircleAvatar(
        backgroundColor: scheme.primary.withValues(alpha: 0.12),
        foregroundColor: scheme.primary,
        child: Icon(icon),
      ),
      title: Text(
        item.title,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: theme.textTheme.titleMedium?.copyWith(
          fontWeight: item.unread ? FontWeight.w700 : FontWeight.w400,
        ),
      ),
      subtitle: Text('$label · ${formatShortDate(item.at)}'),
      trailing: item.unread
          ? Semantics(
              label: '새 알림',
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: scheme.error,
                  shape: BoxShape.circle,
                ),
                child: const SizedBox.square(dimension: 8),
              ),
            )
          : null,
    );
  }
}
