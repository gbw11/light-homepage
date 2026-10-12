import 'package:flutter/material.dart';

import '../../core/ui/status_views.dart';

/// 회원 화면에서 401을 받았을 때 그 자리에 두는 안내 (기획안 §1 · §2-5).
///
/// 로그인 화면으로 튕기지 않고 **이 자리에서** 무엇을 하면 되는지 말한다.
/// [로그인]을 눌러 로그인을 마치면 로그인 화면이 닫히고 이 화면으로 돌아온다 —
/// 그때 화면이 로그인 상태로 다시 그려진다.
class LoginGate extends StatelessWidget {
  const LoginGate({
    super.key,
    required this.onLogin,
    this.message = '로그인하면 볼 수 있어요.',
  });

  final VoidCallback onLogin;
  final String message;

  @override
  Widget build(BuildContext context) {
    return MessageView(
      icon: Icons.lock_outline,
      message: message,
      action: FilledButton(onPressed: onLogin, child: const Text('로그인')),
    );
  }
}
