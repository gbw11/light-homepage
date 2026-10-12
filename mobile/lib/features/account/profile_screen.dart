import 'package:flutter/material.dart';

import '../../core/api/api_error.dart';
import '../../core/auth/auth_state.dart';
import '../../core/auth/auth_user.dart';
import '../../core/config.dart';
import '../../core/ui/status_views.dart';
import 'login_gate.dart';

/// 웹 `ProfileInfo.tsx`와 같은 형식 검사
final _phonePattern = RegExp(r'^010-\d{4}-\d{4}$');

/// 내 정보 (웹 `/my/profile`, WIREFRAME §14-2, 기획안 §2-4 M10).
///
/// 이름 · 아이디 · 권한은 읽기만 하고, **연락처만** 그 자리에서 고친다.
/// 탈퇴는 되돌릴 수 없어 1차는 웹으로 보낸다 (결정 D2).
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({
    super.key,
    required this.auth,
    required this.onLogin,
    required this.openExternal,
  });

  final AuthState auth;
  final VoidCallback onLogin;
  final void Function(String url) openExternal;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  /// 열 때 서버에서 다시 받는다 — 웹에서 연락처를 바꿨을 수 있다
  late Future<AuthUser> _me = widget.auth.refreshMe();

  void _retry() {
    setState(() {
      _me = widget.auth.refreshMe();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          '내 정보',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      body: ListenableBuilder(
        listenable: widget.auth,
        builder: (context, _) => FutureBuilder(
          future: _me,
          builder: (context, snapshot) {
            // 받는 중이거나 실패해도 이미 아는 값이 있으면 그것을 먼저 보인다
            final user = widget.auth.user;
            if (user != null) {
              return _Content(
                user,
                auth: widget.auth,
                openExternal: widget.openExternal,
              );
            }
            if (snapshot.connectionState != ConnectionState.done) {
              return const LoadingView();
            }
            // 보는 사이 세션이 끊겼거나(401) 로그아웃했다
            final error = snapshot.error;
            final loggedOut =
                error == null ||
                (error is ApiError && error.code == ErrorCode.unauthorized);
            if (loggedOut) return LoginGate(onLogin: widget.onLogin);
            return ErrorView(error: error, onRetry: _retry);
          },
        ),
      ),
    );
  }
}

class _Content extends StatelessWidget {
  const _Content(this.user, {required this.auth, required this.openExternal});

  final AuthUser user;
  final AuthState auth;
  final void Function(String url) openExternal;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final withdrawUrl = webUrl('/my/profile');
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        Card(
          margin: EdgeInsets.zero,
          child: Column(
            children: [
              _Row('이름', Text(user.name)),
              const Divider(height: 1, indent: 16, endIndent: 16),
              _Row('아이디', Text(user.loginId ?? '카카오 로그인')),
              const Divider(height: 1, indent: 16, endIndent: 16),
              _PhoneRow(user.phone ?? '', auth: auth),
              const Divider(height: 1, indent: 16, endIndent: 16),
              _Row('권한', Text(user.role.label)),
            ],
          ),
        ),
        const SizedBox(height: 32),
        if (withdrawUrl != null)
          TextButton(
            onPressed: () => openExternal(withdrawUrl),
            style: TextButton.styleFrom(
              foregroundColor: theme.colorScheme.onSurfaceVariant,
            ),
            child: const Text('회원 탈퇴는 웹에서 →'),
          )
        else
          Text(
            '회원 탈퇴는 LIGHT 웹 홈페이지에서 할 수 있어요.',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
      ],
    );
  }
}

/// 이름표 | 값. 글자를 키우면 값이 아래 줄로 내려간다
class _Row extends StatelessWidget {
  const _Row(this.label, this.value);

  final String label;
  final Widget value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 16,
        runSpacing: 4,
        children: [
          Text(
            label,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
              fontWeight: FontWeight.w700,
            ),
          ),
          DefaultTextStyle.merge(
            style: theme.textTheme.bodyLarge,
            child: value,
          ),
        ],
      ),
    );
  }
}

/// 연락처 — [수정]을 누르면 그 자리에서 입력란이 된다 (WIREFRAME §14-2)
class _PhoneRow extends StatefulWidget {
  const _PhoneRow(this.phone, {required this.auth});

  final String phone;
  final AuthState auth;

  @override
  State<_PhoneRow> createState() => _PhoneRowState();
}

class _PhoneRowState extends State<_PhoneRow> {
  late final _controller = TextEditingController(text: widget.phone);
  var _editing = false;
  var _saving = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _cancel() => setState(() {
    _controller.text = widget.phone;
    _error = null;
    _editing = false;
  });

  Future<void> _save() async {
    final phone = _controller.text.trim();
    if (!_phonePattern.hasMatch(phone)) {
      setState(() => _error = '010-0000-0000 형식으로 입력해주세요.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.auth.updatePhone(phone);
      if (!mounted) return;
      setState(() => _editing = false);
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('연락처를 바꿨어요.')));
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = switch (error) {
          ApiError(code: ErrorCode.validationError) => error.message,
          _ => describeError(error),
        };
      });
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_editing) {
      return _Row(
        '연락처',
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(widget.phone),
            TextButton(
              onPressed: () => setState(() => _editing = true),
              child: const Text('수정'),
            ),
          ],
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _controller,
            autofocus: true,
            keyboardType: TextInputType.phone,
            decoration: InputDecoration(
              labelText: '연락처',
              hintText: '010-1234-5678',
              errorText: _error,
            ),
            onSubmitted: (_) => _save(),
          ),
          const SizedBox(height: 8),
          Wrap(
            alignment: WrapAlignment.end,
            spacing: 8,
            children: [
              TextButton(
                onPressed: _saving ? null : _cancel,
                child: const Text('취소'),
              ),
              FilledButton(
                onPressed: _saving ? null : _save,
                child: Text(_saving ? '저장 중...' : '저장'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
