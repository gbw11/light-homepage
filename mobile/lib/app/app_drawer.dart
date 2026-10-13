import 'package:flutter/material.dart';

import '../content/links.dart';
import '../core/auth/auth_state.dart';
import 'paths.dart';

/// 사이드바 — 교회 안내 + 전체 메뉴 (기획안 §3, 결정 D1).
///
/// 역할을 나눈다: **사이드바 = 교회 안내**(처음 온 사람이 찾는 것),
/// **더보기 탭 = 나와 앱**(계정 · 설정). 같은 메뉴를 두 곳에 두지 않는다.
/// 하단 탭 바로가기만은 예외로 둔다 — "전체 메뉴"를 연 사람이 탭을 못 찾고
/// 헤매지 않게.
///
/// 머리에는 로그인 상태를 둔다 — 이름 · 역할, 또는 [로그인].
class AppDrawer extends StatelessWidget {
  const AppDrawer({
    super.key,
    required this.onOpen,
    required this.onTab,
    required this.onLogin,
    required this.onAccount,
    required this.openExternal,
  });

  /// 교회 안내 화면을 탭 위에 연다 ([AppPaths])
  final void Function(String path) onOpen;

  /// 하단 탭으로 옮긴다 (탭 순서 번호)
  final void Function(int tab) onTab;
  final VoidCallback onLogin;

  /// 이름을 누르면 — 계정은 더보기 탭이 맡는다 (결정 D1)
  final VoidCallback onAccount;
  final void Function(String url) openExternal;

  @override
  Widget build(BuildContext context) {
    // 무엇을 누르든 사이드바를 먼저 닫는다 — 열어 둔 채로 화면을 덮으면
    // 돌아왔을 때 사이드바가 그대로 남아 있다
    void then(VoidCallback action) {
      Scaffold.of(context).closeDrawer();
      action();
    }

    ListTile item(
      IconData icon,
      String label, {
      String? subtitle,
      bool external = false,
      required VoidCallback onTap,
    }) => ListTile(
      leading: Icon(icon),
      title: Text(label),
      subtitle: subtitle == null ? null : Text(subtitle),
      trailing: external
          ? const Icon(Icons.open_in_new, size: 18, semanticLabel: '바깥 앱으로 열기')
          : null,
      onTap: () => then(onTap),
    );

    return Drawer(
      child: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(vertical: 8),
          children: [
            _Header(
              onLogin: () => then(onLogin),
              onAccount: () => then(onAccount),
            ),
            const Divider(),
            // 처음 온 사람이 가장 먼저 찾는 화면 (WIREFRAME §2 "최우선")
            item(
              Icons.waving_hand_outlined,
              '처음 오시는 분',
              subtitle: '혼자 오셔도 괜찮아요',
              onTap: () => onOpen(AppPaths.welcome),
            ),
            item(
              Icons.place_outlined,
              '오시는 길',
              onTap: () => onOpen(AppPaths.location),
            ),
            item(
              Icons.schedule_outlined,
              '예배와 모임',
              onTap: () => onOpen(AppPaths.worship),
            ),
            item(
              Icons.info_outline,
              '청년교회 소개',
              onTap: () => onOpen(AppPaths.about),
            ),
            item(
              Icons.groups_outlined,
              '조직도',
              onTap: () => onOpen(AppPaths.organization),
            ),
            const Divider(),
            const _GroupLabel('바로가기'),
            item(Icons.play_circle_outline, '말씀', onTap: () => onTab(1)),
            item(Icons.campaign_outlined, '공지', onTap: () => onTab(2)),
            item(Icons.folder_outlined, '자료', onTap: () => onTab(3)),
            const Divider(),
            item(
              Icons.person_add_alt_outlined,
              '새가족 등록',
              onTap: () => onOpen(AppPaths.newcomer),
            ),
            item(
              Icons.call_outlined,
              '문의하기',
              onTap: () => onOpen(AppPaths.contact),
            ),
            item(
              Icons.photo_camera_outlined,
              '인스타그램',
              external: true,
              onTap: () => openExternal(instagramUrl),
            ),
            item(
              Icons.smart_display_outlined,
              '유튜브',
              external: true,
              onTap: () => openExternal(youtubeChannelUrl),
            ),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.onLogin, required this.onAccount});

  final VoidCallback onLogin;
  final VoidCallback onAccount;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'LIGHT',
            style: theme.textTheme.headlineSmall?.copyWith(
              color: theme.colorScheme.primary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '김해교회 청년교회',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 16),
          switch (AuthScope.maybeOf(context)?.user) {
            final user? => InkWell(
              onTap: onAccount,
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(
                  children: [
                    Icon(
                      Icons.account_circle_outlined,
                      color: theme.colorScheme.primary,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '${user.name}님 · ${user.role.label}',
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const Icon(Icons.chevron_right),
                  ],
                ),
              ),
            ),
            null => OutlinedButton(
              onPressed: onLogin,
              child: const Text('로그인'),
            ),
          },
        ],
      ),
    );
  }
}

class _GroupLabel extends StatelessWidget {
  const _GroupLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: Text(
        label,
        style: theme.textTheme.labelLarge?.copyWith(
          color: theme.colorScheme.onSurfaceVariant,
        ),
      ),
    );
  }
}
