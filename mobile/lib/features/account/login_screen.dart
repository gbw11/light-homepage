import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/api/api_error.dart';
import '../../core/auth/auth_state.dart';
import '../../core/config.dart';
import '../../core/ui/status_views.dart';

/// 로그인 (웹 `/login`, WIREFRAME §10-1, 기획안 §2-5 M1).
///
/// 아이디 · 비밀번호만 있다. 카카오 로그인은 보류(백엔드 콜백이 웹으로만
/// 돌아간다). 가입은 앱 안에서 하고(SignupScreen), 비밀번호 찾기는 웹으로 보낸다.
///
/// 가입을 마치고 오면 방금 만든 아이디를 채워 두고 비밀번호 칸으로 보낸다 —
/// 방금 정한 비밀번호를 바로 한 번 써 보게 한다 (SPEC_API §2.2).
class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    required this.auth,
    required this.onDone,
    required this.onFirstVisit,
    required this.onSignup,
    required this.openExternal,
    this.signedUpLoginId,
  });

  final AuthState auth;

  /// 로그인을 마쳤을 때 — 연 화면으로 돌아간다
  final VoidCallback onDone;
  final VoidCallback onFirstVisit;

  /// 가입 화면을 연다. 가입을 마치고 로그인하러 오면 만든 아이디가 돌아온다
  final Future<String?> Function() onSignup;
  final void Function(String url) openExternal;

  /// 가입 화면에서 곧장 왔을 때 — 방금 만든 아이디
  final String? signedUpLoginId;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
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
  void initState() {
    super.initState();
    if (widget.signedUpLoginId case final loginId?) _fillSignedUp(loginId);
  }

  void _fillSignedUp(String loginId) {
    _loginId.text = loginId;
    _password.clear();
    _error = null;
    _notice = '가입이 완료되었어요. 방금 정한 비밀번호로 로그인해 보세요.';
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _passwordFocus.requestFocus();
    });
  }

  Future<void> _openSignup() async {
    final loginId = await widget.onSignup();
    if (loginId != null && mounted) setState(() => _fillSignedUp(loginId));
  }

  @override
  void dispose() {
    _loginId.dispose();
    _password.dispose();
    _passwordFocus.dispose();
    super.dispose();
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
      body: AutofillGroup(
        child: Form(
          key: _form,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 40),
            children: [
              Text(
                'LIGHT',
                style: theme.textTheme.titleLarge?.copyWith(
                  color: theme.colorScheme.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '로그인',
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '회원 공지 · 주보 · 사진첩 · 월례회 자료를 볼 수 있어요.',
                style: theme.textTheme.bodyLarge?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              if (_notice case final notice?) ...[
                const SizedBox(height: 16),
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
              ],
              const SizedBox(height: 32),
              TextFormField(
                controller: _loginId,
                decoration: const InputDecoration(labelText: '아이디'),
                textInputAction: TextInputAction.next,
                autocorrect: false,
                enableSuggestions: false,
                autofillHints: const [AutofillHints.username],
                validator: (v) =>
                    (v ?? '').trim().isEmpty ? '아이디를 입력해주세요.' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _password,
                focusNode: _passwordFocus,
                obscureText: _hidePassword,
                decoration: InputDecoration(
                  labelText: '비밀번호',
                  suffixIcon: IconButton(
                    onPressed: () =>
                        setState(() => _hidePassword = !_hidePassword),
                    tooltip: _hidePassword ? '비밀번호 보기' : '비밀번호 숨기기',
                    icon: Icon(
                      _hidePassword
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                    ),
                  ),
                ),
                textInputAction: TextInputAction.done,
                autofillHints: const [AutofillHints.password],
                onFieldSubmitted: (_) => _submit(),
                validator: (v) => (v ?? '').isEmpty ? '비밀번호를 입력해주세요.' : null,
              ),
              if (_error case final error?) ...[
                const SizedBox(height: 16),
                Semantics(
                  liveRegion: true,
                  child: Text(
                    error,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.error,
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _submitting ? null : _submit,
                child: Text(_submitting ? '로그인 중...' : '로그인'),
              ),
              const SizedBox(height: 24),
              if (resetUrl != null)
                _Link(
                  '비밀번호를 잊으셨나요?',
                  onPressed: () => widget.openExternal(resetUrl),
                ),
              _Link('처음이신가요? 회원가입', onPressed: _openSignup),
              // 웹 주소가 아직 없다 (config.dart `webBaseUrl` 주석) — 길만 말로 알린다
              if (resetUrl == null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    '비밀번호 찾기는 LIGHT 웹 홈페이지에서 할 수 있어요.',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
              _Link('처음 오시는 분이신가요?', onPressed: widget.onFirstVisit),
            ],
          ),
        ),
      ),
    );
  }
}

class _Link extends StatelessWidget {
  const _Link(this.label, {required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: TextButton(
        onPressed: onPressed,
        style: TextButton.styleFrom(
          padding: EdgeInsets.zero,
          foregroundColor: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
        child: Text('▸ $label'),
      ),
    );
  }
}
