import 'dart:convert';

import 'package:flutter/material.dart';

import '../../core/api/api_error.dart';
import '../../core/auth/auth_state.dart';
import '../../core/ui/status_views.dart';

/// BCrypt가 다루는 상한은 글자 수가 아니라 **72바이트**다 — 한글은 한 글자가
/// 3바이트라 24자면 이미 넘는다 (웹 `lib/password.ts`와 같은 규칙)
const _maxPasswordBytes = 72;

/// 비밀번호 변경 (웹 `/my/profile` ▸ 비밀번호 변경, WIREFRAME §14-2, 기획안 §2-4 M10).
///
/// 성공하면 서버가 **다른 기기를 모두 로그아웃**시키고 이 기기에는 새 쿠키를
/// 준다 (SPEC_API §2.11) — 이 기기는 로그인이 그대로 이어진다.
class PasswordChangeScreen extends StatefulWidget {
  const PasswordChangeScreen({
    super.key,
    required this.auth,
    required this.onDone,
  });

  final AuthState auth;
  final VoidCallback onDone;

  @override
  State<PasswordChangeScreen> createState() => _PasswordChangeScreenState();
}

class _PasswordChangeScreenState extends State<PasswordChangeScreen> {
  final _form = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  final _currentFocus = FocusNode();
  var _submitting = false;

  /// 서버가 짚어 준 오류
  String? _currentError;
  String? _nextError;
  String? _formError;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    _currentFocus.dispose();
    super.dispose();
  }

  String? _validateNext(String? v) {
    final value = v ?? '';
    if (value.length < 8) return '새 비밀번호는 8자 이상이어야 합니다.';
    if (utf8.encode(value).length > _maxPasswordBytes) {
      return '새 비밀번호가 너무 깁니다. 영문·숫자는 72자, 한글은 24자까지입니다.';
    }
    return null;
  }

  Future<void> _submit() async {
    setState(() {
      _currentError = null;
      _nextError = null;
      _formError = null;
    });
    if (!_form.currentState!.validate()) return;

    setState(() => _submitting = true);
    try {
      await widget.auth.changePassword(
        currentPassword: _current.text,
        newPassword: _next.text,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(content: Text('비밀번호를 바꿨어요. 다른 기기에서는 로그아웃됐어요.')),
        );
      widget.onDone();
    } catch (error) {
      if (!mounted) return;
      switch (error) {
        // 현재 비밀번호가 틀림 — 서버는 칸 이름(currentPassword)이 아니라
        // "password"로 짚는다. 웹과 같게 세 칸을 모두 비우고 처음부터 다시 쓰게
        // 한다 (DECISIONS 10-07 (3), 기획안 §2-4)
        case ApiError(code: ErrorCode.validationError, field: 'password'):
          _current.clear();
          _next.clear();
          _confirm.clear();
          setState(() => _currentError = '현재 비밀번호가 올바르지 않습니다.');
          _currentFocus.requestFocus();
        case ApiError(code: ErrorCode.validationError, field: 'newPassword'):
          setState(() => _nextError = error.message);
        case ApiError(code: ErrorCode.validationError):
          setState(() => _formError = error.message);
        default:
          setState(() => _formError = describeError(error));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          '비밀번호 변경',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            Text(
              '바꾸면 이 기기를 뺀 다른 기기에서는 모두 로그아웃돼요.',
              style: theme.textTheme.bodyLarge?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 24),
            TextFormField(
              controller: _current,
              focusNode: _currentFocus,
              obscureText: true,
              autofillHints: const [AutofillHints.password],
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(labelText: '현재 비밀번호'),
              forceErrorText: _currentError,
              validator: (v) => (v ?? '').isEmpty ? '현재 비밀번호를 입력해주세요.' : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _next,
              obscureText: true,
              autofillHints: const [AutofillHints.newPassword],
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                labelText: '새 비밀번호',
                helperText: '8자 이상',
              ),
              forceErrorText: _nextError,
              validator: _validateNext,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _confirm,
              obscureText: true,
              autofillHints: const [AutofillHints.newPassword],
              textInputAction: TextInputAction.done,
              decoration: const InputDecoration(labelText: '새 비밀번호 확인'),
              onFieldSubmitted: (_) => _submit(),
              validator: (v) {
                if ((v ?? '').isEmpty) return '새 비밀번호 확인을 입력해주세요.';
                if (v != _next.text) return '새 비밀번호가 일치하지 않습니다.';
                return null;
              },
            ),
            if (_formError case final error?) ...[
              const SizedBox(height: 16),
              Text(
                error,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.error,
                ),
              ),
            ],
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _submitting ? null : _submit,
              child: Text(_submitting ? '바꾸는 중...' : '비밀번호 변경'),
            ),
          ],
        ),
      ),
    );
  }
}
