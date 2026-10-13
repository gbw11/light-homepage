import 'package:flutter/material.dart';

import '../auth/auth_state.dart';

/// 마이페이지로 가는 길 — 탭 틀(`AppShell`)이 단다.
///
/// 버튼은 탭 화면마다 있지만 어디로 갈지는 탭 틀이 정한다 (화면 이동은 화면이
/// 정하지 않는다 — `HomeActions`와 같은 원칙). ☰([MenuButton])이 탭 틀의
/// 사이드바를 찾는 것과 같은 구조다.
class MyPageEntry extends InheritedWidget {
  const MyPageEntry({super.key, required this.onOpen, required super.child});

  final VoidCallback onOpen;

  static MyPageEntry? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<MyPageEntry>();

  @override
  bool updateShouldNotify(MyPageEntry old) => onOpen != old.onOpen;
}

/// 탭 화면 상단 오른쪽 — 동그란 사람 아이콘. 로그인했으면 마이페이지,
/// 아니면 로그인 · 회원가입 (갈 곳은 탭 틀이 정한다 — [MyPageEntry])
///
/// 탭 틀 없이 화면만 띄우면(테스트 등) 갈 곳이 없어 아무 일도 없다.
class ProfileButton extends StatelessWidget {
  const ProfileButton({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: IconButton(
        onPressed: MyPageEntry.maybeOf(context)?.onOpen,
        tooltip: (AuthScope.maybeOf(context)?.isLoggedIn ?? false)
            ? '마이페이지'
            : '로그인 · 회원가입',
        style: IconButton.styleFrom(
          backgroundColor: scheme.primary,
          foregroundColor: scheme.onPrimary,
          // 탭 틀이 없을 때도 같은 모양이다 — 회색으로 바래지 않게
          disabledBackgroundColor: scheme.primary,
          disabledForegroundColor: scheme.onPrimary,
          fixedSize: const Size.square(40),
          shape: const CircleBorder(),
        ),
        icon: const Icon(Icons.person_outline_rounded, size: 24),
      ),
    );
  }
}
