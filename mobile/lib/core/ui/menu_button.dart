import 'package:flutter/material.dart';

/// 탭 화면 상단 왼쪽 ☰ — 사이드바(교회 안내 · 전체 메뉴)를 연다.
///
/// 탭 화면마다 자기 [Scaffold]가 있어서 가장 가까운 Scaffold는 탭 화면 것이다.
/// 사이드바는 탭 틀(가장 바깥) Scaffold에 달려 있으므로 **맨 바깥**을 찾는다.
/// 탭 틀 없이 화면만 띄우면(테스트 등) 열 사이드바가 없어 아무 일도 없다.
class MenuButton extends StatelessWidget {
  const MenuButton({super.key});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.menu),
      tooltip: '전체 메뉴',
      onPressed: () =>
          context.findRootAncestorStateOfType<ScaffoldState>()?.openDrawer(),
    );
  }
}
