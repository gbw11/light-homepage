import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/api/api_error.dart';
import '../../core/auth/auth_state.dart';
import '../../core/config.dart';
import '../../core/ui/status_views.dart';

/// 로그인 (웹 `/login`, WIREFRAME §10-1, 기획안 §2-5 M1).
///
/// 아이디 · 비밀번호만 있다. 카카오 로그인은 보류(백엔드 콜백이 웹으로만
/// 돌아간다), 가입 · 비밀번호 찾기는 웹으로 보낸다 (기획안 결정 D2).
class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    required this.auth,
    required this.onDone,
    required this.onFirstVisit,
    required this.openExternal,
  });

  final AuthState auth;

  /// 로그인을 마쳤을 때 — 연 화면으로 돌아간다
  final VoidCallback onDone;
  final VoidCallback onFirstVisit;
  final void Function(String url) openExternal;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _form = GlobalKey<FormState>();
  final _loginId = TextEditingController();
  final _password = TextEditingController();
  var _hidePassword = true;
  var _submitting = false;
  String? _error;

  @override
  void dispose() {
    _loginId.dispose();
    _password.dispose();
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
    final signupUrl = webUrl('/signup');
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
              if (signupUrl != null)
                _Link(
                  '처음이신가요? 회원가입',
                  onPressed: () => widget.openExternal(signupUrl),
                ),
              // 웹 주소가 아직 없다 (config.dart `webBaseUrl` 주석) — 길만 말로 알린다
              if (signupUrl == null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    '회원가입과 비밀번호 찾기는 LIGHT 웹 홈페이지에서 할 수 있어요.',
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
