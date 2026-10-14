import 'package:flutter/material.dart';

import '../auth/auth_state.dart';

/// 임원 이상에게만 보이는 오른쪽 아래 버튼 — 「공지 쓰기」 · 「주보 올리기」 같은 것.
///
/// 회원 · 비로그인이면 null — `Scaffold.floatingActionButton`에 그대로 넣는다.
/// 색은 테마 기본(primaryContainer, 형광빛) 대신 앱 초록이다
Widget? leaderFab(
  BuildContext context, {
  required String label,
  required IconData icon,
  required VoidCallback? onPressed,
}) {
  final isLeader = AuthScope.maybeOf(context)?.user?.role.isLeader ?? false;
  if (!isLeader || onPressed == null) return null;
  final scheme = Theme.of(context).colorScheme;
  return FloatingActionButton.extended(
    onPressed: onPressed,
    backgroundColor: scheme.primary,
    foregroundColor: scheme.onPrimary,
    icon: Icon(icon),
    label: Text(label),
  );
}
