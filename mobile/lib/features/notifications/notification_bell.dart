import 'package:flutter/material.dart';

import 'inbox.dart';

/// 홈 상단 오른쪽, 사람 버튼 옆의 종 — 안 본 알림 수를 단다 ([NotificationInbox]).
///
/// 알림함([InboxScope])이 없으면(테스트 등) 숫자 없이 종만 있다.
class NotificationBell extends StatelessWidget {
  const NotificationBell({super.key, required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final count = InboxScope.maybeOf(context)?.unreadCount ?? 0;
    return IconButton(
      onPressed: onPressed,
      tooltip: count > 0 ? '알림 $count개' : '알림',
      icon: Badge(
        isLabelVisible: count > 0,
        label: Text(count > 99 ? '99+' : '$count'),
        child: const Icon(Icons.notifications_none_rounded, size: 26),
      ),
    );
  }
}
