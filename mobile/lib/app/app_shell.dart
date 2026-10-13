import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/ui/profile_button.dart';
import 'app_drawer.dart';
import 'paths.dart';

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
  // 자물쇠는 달지 않는다 — 웹이 09-16에 뺐고, 비로그인은 탭 안의 안내로
  // 알린다 (기획안 결정 D4)
  (label: '자료', icon: Icons.folder_outlined, selectedIcon: Icons.folder),
  // 더보기 탭은 없앴다 — 계정 · 앱 정보는 상단 오른쪽 사람 버튼의 마이페이지다
];

/// 하단 탭 틀 + 사이드바(☰).
///
/// 탭마다 화면 기록이 따로 있다 — 다른 탭에 다녀와도 홈의 스크롤과 불러온 데이터가
/// 그대로다 ([StatefulShellRoute.indexedStack]).
///
/// 사이드바는 이 틀의 [Scaffold]에 단다. 탭 화면이 아니라 여기에 두어야 어느
/// 탭에서 열어도 같은 사이드바이고, 탭 화면들은 ☰ 버튼만 둔다 (`MenuButton`).
/// 상단 오른쪽 사람 버튼(`ProfileButton`)이 갈 곳(마이페이지)도 여기서 정한다.
class AppShell extends StatefulWidget {
  const AppShell({
    super.key,
    required this.shell,
    required this.openExternal,
    required this.onLogin,
  });

  final StatefulNavigationShell shell;
  final void Function(String url) openExternal;
  final VoidCallback onLogin;

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  final _scaffold = GlobalKey<ScaffoldState>();
  var _drawerOpen = false;

  StatefulNavigationShell get shell => widget.shell;

  void _select(int index) {
    // 지금 탭을 한 번 더 누르면 그 탭의 첫 화면으로 돌아간다 (흔한 앱 관례)
    shell.goBranch(index, initialLocation: index == shell.currentIndex);
  }

  @override
  Widget build(BuildContext context) {
    final onHome = shell.currentIndex == 0;
    void openMyPage() => context.push(AppPaths.my);
    return MyPageEntry(
      onOpen: openMyPage,
      child: PopScope(
        // 뒤로가기는 가장 위에 있는 것부터 닫는다:
        //   사이드바 → 탭 안에 쌓인 화면(go_router가 처리) → 홈이 아니면 홈으로 →
        //   홈이면 앱을 닫는다.
        // 사이드바를 따로 보지 않으면 사이드바를 닫으면서 홈으로까지 가 버린다
        canPop: onHome && !_drawerOpen,
        onPopInvokedWithResult: (didPop, _) {
          if (didPop) return;
          if (_drawerOpen) {
            _scaffold.currentState?.closeDrawer();
          } else {
            _select(0);
          }
        },
        child: Scaffold(
          key: _scaffold,
          onDrawerChanged: (open) => setState(() => _drawerOpen = open),
          drawer: AppDrawer(
            onOpen: (path) => context.push(path),
            onTab: _select,
            onLogin: widget.onLogin,
            onAccount: openMyPage,
            openExternal: widget.openExternal,
          ),
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
      ),
    );
  }
}
