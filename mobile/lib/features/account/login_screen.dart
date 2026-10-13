import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/api/api_error.dart';
import '../../core/auth/auth_api.dart';
import '../../core/auth/auth_state.dart';
import '../../core/config.dart';
import '../../core/ui/status_views.dart';
import 'auth_form.dart';
import 'signup_form.dart';

/// 로그인 화면 위쪽 칸 — 로그인 · 회원가입
enum AuthMode { login, signup }

/// 로그인 · 회원가입 (웹 `/login` · `/signup`, WIREFRAME §10-1 · §10-2).
///
/// ```
///        (엠블럼)
/// ( [🔒 로그인] [👤+ 회원가입] )
/// ┌ 흰 카드 ───────────────┐
/// │ 아이디 *  [🪪 ……… ]     │
/// │ 비밀번호 * [🔒 ……… 👁]  │
/// │            비밀번호 찾기 │
/// │ (  로그인하기 →  )      │
/// └────────────────────────┘
///   처음 오시는 분이신가요? ›
/// ```
///
/// 한 화면 안에서 위쪽 칸으로 로그인과 회원가입([SignupForm])을 오간다. 가입을
/// 마치면 로그인 칸으로 돌아와 방금 만든 아이디를 채우고 비밀번호 칸으로 보낸다 —
/// 방금 정한 비밀번호를 바로 한 번 써 보게 한다 (SPEC_API §2.2).
///
/// 카카오 로그인은 보류(백엔드 콜백이 웹으로만 돌아간다). 비밀번호 찾기는 웹으로 보낸다.
class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    required this.auth,
    required this.signupApi,
    required this.onDone,
    required this.onFirstVisit,
    required this.openExternal,
    this.initialMode = AuthMode.login,
  });

  final AuthState auth;

  /// 가입(명단 확인 · 계정 만들기)을 부른다
  final AuthApi signupApi;

  /// 로그인을 마쳤을 때 — 연 화면으로 돌아간다
  final VoidCallback onDone;
  final VoidCallback onFirstVisit;
  final void Function(String url) openExternal;

  /// 처음 보여줄 칸 — 마이페이지의 [회원가입]으로 열면 회원가입
  final AuthMode initialMode;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  late var _mode = widget.initialMode;

  final _form = GlobalKey<FormState>();
  final _loginId = TextEditingController();
  final _password = TextEditingController();
  final _passwordFocus = FocusNode();
  var _hidePassword = true;
  var _submitting = false;
  String? _error;

  /// 가입을 마치고 왔을 때의 안내
  String? _notice;

  @override
  void dispose() {
    _loginId.dispose();
    _password.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  void _signedUp(String loginId) {
    setState(() {
      _mode = AuthMode.login;
      _loginId.text = loginId;
      _password.clear();
      _error = null;
      _notice = '가입이 완료되었어요. 방금 정한 비밀번호로 로그인해 보세요.';
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _passwordFocus.requestFocus();
    });
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _error = null);
    if (!_form.currentState!.validate()) return;

    setState(() => _submitting = true);
    try {
      await widget.auth.login(
        loginId: _loginId.text.trim(),
        password: _password.text,
      );
      // 비밀번호 관리자(구글 등)에 저장할지 묻게 한다
      TextInput.finishAutofillContext();
      if (mounted) widget.onDone();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = switch (error) {
          // 5회 실패 잠금도 서버가 같은 응답을 준다 — 문구도 하나다 (SPEC_API §2.3)
          ApiError(code: ErrorCode.unauthorized) => '아이디 또는 비밀번호가 올바르지 않습니다.',
          _ => describeError(error),
        };
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final resetUrl = webUrl('/password/reset');

    return Scaffold(
      appBar: AppBar(),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 40),
        children: [
          const _Header(),
          const SizedBox(height: 24),
          _ModeSwitch(
            mode: _mode,
            onChanged: (mode) => setState(() => _mode = mode),
          ),
          const SizedBox(height: 20),
          AuthCard(
            child: switch (_mode) {
              AuthMode.login => _loginForm(theme, resetUrl),
              AuthMode.signup => SignupForm(
                auth: widget.signupApi,
                onLogin: _signedUp,
              ),
            },
          ),
          const SizedBox(height: 16),
          if (_mode == AuthMode.login && resetUrl == null)
            // 웹 주소가 아직 없다 (config.dart `webBaseUrl` 주석) — 길만 말로 알린다
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                '비밀번호 찾기는 LIGHT 웹 홈페이지에서 할 수 있어요.',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ),
          Center(
            child: TextButton(
              onPressed: widget.onFirstVisit,
              style: TextButton.styleFrom(
                foregroundColor: theme.colorScheme.onSurfaceVariant,
              ),
              child: const Text('처음 오시는 분이신가요? ›'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _loginForm(ThemeData theme, String? resetUrl) {
    return AutofillGroup(
      child: Form(
        key: _form,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_notice case final notice?) ...[
              Semantics(
                liveRegion: true,
                child: Text(
                  notice,
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: theme.colorScheme.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],
            AuthField(
              label: '아이디',
              icon: Icons.badge_outlined,
              controller: _loginId,
              hint: '아이디를 입력해 주세요',
              textInputAction: TextInputAction.next,
              autocorrect: false,
              autofillHints: const [AutofillHints.username],
              validator: (v) =>
                  (v ?? '').trim().isEmpty ? '아이디를 입력해주세요.' : null,
            ),
            const SizedBox(height: 16),
            AuthField(
              label: '비밀번호',
              icon: Icons.lock_outline,
              controller: _password,
              focusNode: _passwordFocus,
              hint: '비밀번호를 입력해 주세요',
              obscureText: _hidePassword,
              suffix: PasswordVisibilityButton(
                hidden: _hidePassword,
                onToggle: () => setState(() => _hidePassword = !_hidePassword),
              ),
              textInputAction: TextInputAction.done,
              autofillHints: const [AutofillHints.password],
              onSubmitted: (_) => _submit(),
              validator: (v) => (v ?? '').isEmpty ? '비밀번호를 입력해주세요.' : null,
            ),
            if (resetUrl != null)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => widget.openExternal(resetUrl),
                  style: TextButton.styleFrom(
                    foregroundColor: theme.colorScheme.onSurfaceVariant,
                    textStyle: const TextStyle(
                      decoration: TextDecoration.underline,
                    ),
                  ),
                  child: const Text('비밀번호 찾기'),
                ),
              ),
            if (_error case final error?) ...[
              const SizedBox(height: 8),
              AuthErrorText(error),
            ],
            const SizedBox(height: 20),
            AuthSubmitButton(
              label: '로그인하기',
              busyLabel: '로그인 중...',
              busy: _submitting,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}

/// 엠블럼만 — 글은 두지 않는다 (사용자 결정 2026-10-13)
class _Header extends StatelessWidget {
  const _Header();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Image.asset(
        'assets/images/logo.png',
        height: 120,
        // 이름은 위쪽 칸(로그인 · 회원가입)과 카드가 말한다 — 그림은 꾸밈이다
        excludeFromSemantics: true,
      ),
    );
  }
}

/// ( [🔒 로그인] [👤+ 회원가입] ) — 고른 쪽이 짙은 초록 알약이다
class _ModeSwitch extends StatelessWidget {
  const _ModeSwitch({required this.mode, required this.onChanged});

  final AuthMode mode;
  final ValueChanged<AuthMode> onChanged;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.outlineVariant.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: Row(
          children: [
            for (final (value, icon, label) in [
              (AuthMode.login, Icons.lock_outline, '로그인'),
              (AuthMode.signup, Icons.person_add_alt, '회원가입'),
            ])
              Expanded(
                child: _ModeTab(
                  icon: icon,
                  label: label,
                  selected: mode == value,
                  onTap: () => onChanged(value),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _ModeTab extends StatelessWidget {
  const _ModeTab({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final fg = selected ? scheme.onPrimary : scheme.onSurface;
    return Semantics(
      button: true,
      selected: selected,
      inMutuallyExclusiveGroup: true,
      child: Material(
        color: selected ? scheme.primary : Colors.transparent,
        shape: const StadiumBorder(),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 48),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, size: 20, color: fg),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      label,
                      style: theme.textTheme.titleSmall?.copyWith(
                        color: fg,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
