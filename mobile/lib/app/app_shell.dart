import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// 하단 탭 하나
typedef AppTab = ({String label, IconData icon, IconData selectedIcon});

/// 하단 탭 순서. 라우터의 가지(branch) 순서와 같아야 한다 (`router.dart`)
const appTabs = <AppTab>[
  (label: '홈', icon: Icons.home_outlined, selectedIcon: Icons.home),
  (
    label: '말씀',
    icon: Icons.play_circle_outline,
    selectedIcon: Icons.play_circle,
  ),
  (label: '소식', icon: Icons.campaign_outlined, selectedIcon: Icons.campaign),
  // 회원 전용이라 자물쇠로 둔다 — 웹 메뉴의 「🔒 자료」와 같은 신호
  (label: '자료', icon: Icons.lock_outline, selectedIcon: Icons.lock),
  (label: '더보기', icon: Icons.menu, selectedIcon: Icons.menu),
];

/// 하단 탭 틀.
///
/// 탭마다 화면 기록이 따로 있다 — 다른 탭에 다녀와도 홈의 스크롤과 불러온 데이터가
/// 그대로다 ([StatefulShellRoute.indexedStack]).
class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  void _select(int index) {
    // 지금 탭을 한 번 더 누르면 그 탭의 첫 화면으로 돌아간다 (흔한 앱 관례)
    shell.goBranch(index, initialLocation: index == shell.currentIndex);
  }

  @override
  Widget build(BuildContext context) {
    final onHome = shell.currentIndex == 0;
    return PopScope(
      // 홈이 아닌 탭에서 뒤로가기를 누르면 앱을 닫지 않고 홈으로 온다.
      // 탭 안에 쌓인 화면이 있으면 그 화면이 먼저 닫힌다 (go_router가 처리)
      canPop: onHome,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _select(0);
      },
      child: Scaffold(
        body: shell,
        bottomNavigationBar: NavigationBar(
          selectedIndex: shell.currentIndex,
          onDestinationSelected: _select,
          destinations: [
            for (final tab in appTabs)
              NavigationDestination(
                icon: Icon(tab.icon),
                selectedIcon: Icon(tab.selectedIcon),
                label: tab.label,
              ),
          ],
        ),
      ),
    );
  }
}
