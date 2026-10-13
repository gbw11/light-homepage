import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/api/api_error.dart';
import '../../core/auth/auth_api.dart';
import '../../core/auth/auth_user.dart';
import '../../core/format/dashed_digits_formatter.dart';
import '../../core/ui/status_views.dart';
import '../../core/ui/form_card.dart';

/// BCrypt가 받는 비밀번호 상한 — 글자 수가 아니라 **바이트**다. 한글은 한 글자가
/// 3바이트라 24자면 이미 넘는다 (웹 `lib/password.ts`와 같은 규칙)
const _maxPasswordBytes = 72;

/// 서버 규칙 그대로 (`RegisterRequest.loginId`). 웹은 더 좁게(밑줄 없이 20자) 받지만
/// 서버가 받는 아이디를 앱이 막을 이유는 없다
final _loginIdPattern = RegExp(r'^[a-z0-9_]{4,30}$');
final _phonePattern = RegExp(r'^010-\d{4}-\d{4}$');

/// 회원가입 (웹 `/signup`, WIREFRAME §10-2, SPEC_API §2.1~2.2).
/// 로그인 화면의 「회원가입」 칸 안에 들어간다 (`LoginScreen`).
///
/// 1. **본인 확인** — 이름(동명이인 접미사 포함) · 생년월일 · 전화번호를 교회 명단과
///    대조한다. 실패는 칸마다 짚지 않고 **문구 하나**다 — 어느 칸이 틀렸는지 알려주면
///    명단 정보를 캐낼 수 있다. 동명이인만 "임원에게 문의"로 따로 안내한다.
/// 2. **계정 만들기** — 1단계에서 받은 1회용 토큰(5분)으로 아이디 · 비밀번호를 정한다.
///    만들자마자 회원(MEMBER)이다 — 승인 절차가 없다.
/// 3. 가입은 로그인 쿠키를 주지 않는다 — **로그인으로 보낸다.** 방금 정한 비밀번호를
///    한 번 써 보게 해서 "가입은 됐는데 비밀번호를 잘못 기억한" 상태를 바로 잡는다.
///
/// 카카오로 계속하기(웹 2단계의 다른 수단)는 앱에서 보류다 — 백엔드 콜백이 웹으로만
/// 돌아간다.
class SignupForm extends StatefulWidget {
  const SignupForm({super.key, required this.auth, required this.onLogin});

  final AuthApi auth;

  /// 로그인으로 간다 — 가입을 마쳤으면 방금 만든 아이디
  final void Function(String loginId) onLogin;

  @override
  State<SignupForm> createState() => _SignupFormState();
}

sealed class _Step {
  const _Step();
}

class _Verify extends _Step {
  const _Verify();
}

class _Register extends _Step {
  const _Register(this.verified);

  final VerifiedRoster verified;
}

class _Expired extends _Step {
  const _Expired();
}

class _Done extends _Step {
  const _Done({required this.name, required this.loginId});

  final String name;
  final String loginId;
}

class _SignupFormState extends State<SignupForm> {
  _Step _step = const _Verify();

  // 1단계 입력은 가입 전체가 들고 있는다 — 2단계에서 뒤로 오거나 시간이 지나
  // 다시 확인할 때 처음부터 다시 쓰지 않게
  final _name = TextEditingController();
  final _birthDate = TextEditingController();
  final _phone = TextEditingController();

  @override
  void dispose() {
    _name.dispose();
    _birthDate.dispose();
    _phone.dispose();
    super.dispose();
  }

  void _go(_Step step) => setState(() => _step = step);

  @override
  Widget build(BuildContext context) {
    final step = _step;
    return PopScope(
      // 2단계 · 만료에서 뒤로가기는 1단계로 — 화면을 통째로 닫지 않는다
      canPop: step is _Verify || step is _Done,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _go(const _Verify());
      },
      child: switch (step) {
        _Verify() => _VerifyStep(
          auth: widget.auth,
          name: _name,
          birthDate: _birthDate,
          phone: _phone,
          onVerified: (verified) => _go(_Register(verified)),
        ),
        _Register(:final verified) => _RegisterStep(
          key: ValueKey(verified.registrationToken),
          auth: widget.auth,
          verified: verified,
          birthDate: _birthDate.text,
          phone: _phone.text,
          onExpired: () => _go(const _Expired()),
          onDone: (name, loginId) => _go(_Done(name: name, loginId: loginId)),
        ),
        _Expired() => _Result(
          emoji: '⌛',
          title: '시간이 지났습니다',
          message: '본인 확인은 5분 안에 마쳐야 해요. 다시 확인해 주세요.',
          action: '다시 확인하기',
          onAction: () => _go(const _Verify()),
        ),
        _Done(:final name, :final loginId) => _Result(
          emoji: '🎉',
          title: '가입이 완료되었습니다',
          message: '$name님, 방금 정한 비밀번호로 로그인해 보세요.',
          action: '로그인하기',
          onAction: () => widget.onLogin(loginId),
        ),
      },
    );
  }
}

class _VerifyStep extends StatefulWidget {
  const _VerifyStep({
    required this.auth,
    required this.name,
    required this.birthDate,
    required this.phone,
    required this.onVerified,
  });

  final AuthApi auth;
  final TextEditingController name;
  final TextEditingController birthDate;
  final TextEditingController phone;
  final void Function(VerifiedRoster verified) onVerified;

  @override
  State<_VerifyStep> createState() => _VerifyStepState();
}

class _VerifyStepState extends State<_VerifyStep> {
  final _form = GlobalKey<FormState>();
  var _submitting = false;
  String? _error;

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _error = null);
    if (!_form.currentState!.validate()) return;

    setState(() => _submitting = true);
    try {
      final verified = await widget.auth.verifyRoster(
        name: widget.name.text.trim(),
        birthDate: widget.birthDate.text,
        phone: widget.phone.text,
      );
      if (mounted) widget.onVerified(verified);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = switch (error) {
          // 불일치 · 명단 없음 · 이미 가입 · 잦은 시도 — 서버가 일부러 하나로 묶었다.
          // 어느 칸인지 덧붙이지 않는다 (SPEC_API §2.1 명단 정보 탐색 방지)
          ApiError(code: ErrorCode.unauthorized) =>
            '명단에서 확인되지 않습니다.\n'
                '입력한 내용이 명단과 같은지 확인해 주세요. '
                '이미 가입했다면 로그인해 주세요.',
          // 동명이인 2건 이상 — 입력으로 풀 수 없다. 서버 문구가 "임원에게 문의"다
          ApiError(code: ErrorCode.validationError, :final message) => message,
          _ => describeError(error),
        };
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const _StepLabel(
            step: 1,
            title: '본인 확인',
            description: '청년교회 명단과 대조해 본인을 확인합니다.',
          ),
          const SizedBox(height: 20),
          CardField(
            label: '이름',
            icon: Icons.person_outline,
            controller: widget.name,
            hint: '이름을 입력해 주세요',
            helper: '동명이인은 명단의 알파벳까지 입력해 주세요 (예: 김도연a)',
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.name],
            validator: (v) =>
                (v ?? '').trim().length < 2 ? '이름을 입력해 주세요.' : null,
          ),
          const SizedBox(height: 16),
          CardField(
            label: '생년월일',
            icon: Icons.cake_outlined,
            controller: widget.birthDate,
            hint: '2001-03-14',
            helper: '숫자만 누르면 돼요',
            keyboardType: TextInputType.number,
            inputFormatters: const [DashedDigitsFormatter.birthDate()],
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.birthday],
            validator: (v) => isValidBirthDate(v ?? '')
                ? null
                : '생년월일을 2001-03-14처럼 입력해 주세요.',
          ),
          const SizedBox(height: 16),
          CardField(
            label: '전화번호',
            icon: Icons.phone_outlined,
            controller: widget.phone,
            hint: '010-1234-5678',
            keyboardType: TextInputType.phone,
            inputFormatters: const [DashedDigitsFormatter.phone()],
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.telephoneNumber],
            onSubmitted: (_) => _submit(),
            validator: (v) => _phonePattern.hasMatch(v ?? '')
                ? null
                : '전화번호를 010-1234-5678처럼 입력해 주세요.',
          ),
          if (_error case final error?) ...[
            const SizedBox(height: 16),
            FormErrorText(error),
          ],
          const SizedBox(height: 24),
          PillSubmitButton(
            label: '확인하기',
            busyLabel: '확인 중...',
            busy: _submitting,
            onPressed: _submit,
          ),
        ],
      ),
    );
  }
}

/// `YYYY-MM-DD` 모양이고 실제 있는 날짜인지 — `2001-02-30`은 모양만 맞다
bool isValidBirthDate(String value) {
  final match = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(value);
  if (match == null) return false;
  final [y, m, d] = [for (var i = 1; i <= 3; i++) int.parse(match[i]!)];
  final date = DateTime.utc(y, m, d);
  // 없는 날짜는 DateTime이 다음 달로 넘겨 버린다 — 되돌려 비교한다
  return date.year == y &&
      date.month == m &&
      date.day == d &&
      y >= 1900 &&
      date.isBefore(DateTime.now().toUtc());
}

class _RegisterStep extends StatefulWidget {
  const _RegisterStep({
    super.key,
    required this.auth,
    required this.verified,
    required this.birthDate,
    required this.phone,
    required this.onExpired,
    required this.onDone,
  });

  final AuthApi auth;
  final VerifiedRoster verified;

  /// 1단계에서 넣은 값 — 비밀번호가 이것과 같으면 서버가 거절한다
  final String birthDate;
  final String phone;
  final VoidCallback onExpired;
  final void Function(String name, String loginId) onDone;

  @override
  State<_RegisterStep> createState() => _RegisterStepState();
}

class _RegisterStepState extends State<_RegisterStep> {
  final _form = GlobalKey<FormState>();
  final _loginId = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  var _hidePassword = true;
  var _submitting = false;
  String? _error;
  String? _loginIdError;
  String? _passwordError;

  @override
  void dispose() {
    _loginId.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  String? _validatePassword(String? value) {
    final v = value ?? '';
    if (v.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
    if (utf8.encode(v).length > _maxPasswordBytes) {
      return '비밀번호가 너무 깁니다. 영문 · 숫자는 72자, 한글은 24자까지입니다.';
    }
    // 서버 규칙(SPEC_API §2.2)을 미리 걸러 왕복을 줄인다 — 최종 판단은 서버
    String digits(String s) => s.replaceAll(RegExp(r'\D'), '');
    final typed = digits(v);
    if (typed.isNotEmpty &&
        (typed == digits(widget.birthDate) || typed == digits(widget.phone))) {
      return '생년월일 · 전화번호와 같은 비밀번호는 쓸 수 없습니다.';
    }
    return null;
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() {
      _error = null;
      _loginIdError = null;
      _passwordError = null;
    });
    if (!_form.currentState!.validate()) return;

    setState(() => _submitting = true);
    final loginId = _loginId.text.trim();
    try {
      final name = await widget.auth.register(
        registrationToken: widget.verified.registrationToken,
        loginId: loginId,
        password: _password.text,
      );
      // 비밀번호 관리자(구글 등)에 저장할지 묻게 한다
      TextInput.finishAutofillContext();
      if (mounted) widget.onDone(name, loginId);
    } catch (error) {
      if (!mounted) return;
      switch (error) {
        // 토큰 만료 · 재사용 (SPEC_API §2.2)
        case ApiError(code: ErrorCode.unauthorized):
          widget.onExpired();
          return;
        case ApiError(field: 'loginId', :final message):
          setState(() => _loginIdError = message);
        case ApiError(field: 'password', :final message):
          setState(() => _passwordError = message);
        default:
          setState(() => _error = describeError(error));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final eye = PasswordVisibilityButton(
      hidden: _hidePassword,
      onToggle: () => setState(() => _hidePassword = !_hidePassword),
    );
    return AutofillGroup(
      child: Form(
        key: _form,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _StepLabel(
              step: 2,
              title: '계정 만들기',
              description: '${widget.verified.name}님, 확인되었습니다.',
            ),
            const SizedBox(height: 4),
            _Countdown(
              seconds: widget.verified.expiresIn,
              onExpired: widget.onExpired,
            ),
            const SizedBox(height: 20),
            CardField(
              label: '아이디',
              icon: Icons.badge_outlined,
              controller: _loginId,
              hint: '아이디를 정해 주세요',
              helper: '영문 소문자 · 숫자 · 밑줄(_) 4~30자',
              errorText: _loginIdError,
              textInputAction: TextInputAction.next,
              autocorrect: false,
              autofillHints: const [AutofillHints.newUsername],
              validator: (v) => _loginIdPattern.hasMatch((v ?? '').trim())
                  ? null
                  : '아이디는 영문 소문자 · 숫자 · 밑줄(_) 4~30자입니다.',
            ),
            const SizedBox(height: 16),
            CardField(
              label: '비밀번호',
              icon: Icons.lock_outline,
              controller: _password,
              hint: '비밀번호를 정해 주세요',
              helper: '8자 이상 · 생년월일 · 전화번호와 같으면 쓸 수 없어요',
              errorText: _passwordError,
              obscureText: _hidePassword,
              suffix: eye,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.newPassword],
              validator: _validatePassword,
            ),
            const SizedBox(height: 16),
            CardField(
              label: '비밀번호 확인',
              icon: Icons.lock_outline,
              controller: _confirm,
              hint: '비밀번호를 한 번 더 입력해 주세요',
              obscureText: _hidePassword,
              textInputAction: TextInputAction.done,
              autofillHints: const [AutofillHints.newPassword],
              onSubmitted: (_) => _submit(),
              validator: (v) {
                if ((v ?? '').isEmpty) return '비밀번호를 한 번 더 입력해 주세요.';
                if (v != _password.text) return '비밀번호가 일치하지 않습니다.';
                return null;
              },
            ),
            if (_error case final error?) ...[
              const SizedBox(height: 16),
              FormErrorText(error),
            ],
            const SizedBox(height: 24),
            PillSubmitButton(
              label: '가입하기',
              busyLabel: '가입 중...',
              busy: _submitting,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}

/// 「1/2 본인 확인」 + 한 줄 설명
class _StepLabel extends StatelessWidget {
  const _StepLabel({
    required this.step,
    required this.title,
    required this.description,
  });

  final int step;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          header: true,
          label: '2단계 중 $step단계, $title',
          excludeSemantics: true,
          child: Text(
            '$step/2  $title',
            style: theme.textTheme.titleMedium?.copyWith(
              color: theme.colorScheme.primary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          description,
          style: theme.textTheme.bodyLarge?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}

/// 남은 시간 「4:59 안에 마쳐 주세요」. 0이 되면 [onExpired]
///
/// 1초 타이머만 세면 앱이 잠깐 뒤로 갔다 오는 동안 멈춘 시간을 놓친다 — 벽시계와
/// 센 횟수 중 큰 쪽으로 잰다 (월례회 자료 보기와 같은 방식)
class _Countdown extends StatefulWidget {
  const _Countdown({required this.seconds, required this.onExpired});

  final int seconds;
  final VoidCallback onExpired;

  @override
  State<_Countdown> createState() => _CountdownState();
}

class _CountdownState extends State<_Countdown> {
  final _startedAt = DateTime.now();
  var _ticks = 0;
  late final Timer _timer;
  var _fired = false;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      setState(() => _ticks++);
      if (_remaining <= 0 && !_fired) {
        _fired = true;
        widget.onExpired();
      }
    });
  }

  int get _remaining {
    final wall = DateTime.now().difference(_startedAt).inSeconds;
    return widget.seconds - (wall > _ticks ? wall : _ticks);
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final left = _remaining.clamp(0, widget.seconds);
    final mm = left ~/ 60;
    final ss = (left % 60).toString().padLeft(2, '0');
    return Text(
      '아이디와 비밀번호를 정해 주세요. $mm:$ss 안에 마쳐 주세요.',
      style: theme.textTheme.bodyMedium?.copyWith(
        color: theme.colorScheme.onSurfaceVariant,
        fontWeight: FontWeight.w600,
      ),
    );
  }
}

/// 만료 · 완료 — 큰 그림 · 제목 · 설명 · 버튼 하나
class _Result extends StatelessWidget {
  const _Result({
    required this.emoji,
    required this.title,
    required this.message,
    required this.action,
    required this.onAction,
  });

  final String emoji;
  final String title;
  final String message;
  final String action;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 8),
        ExcludeSemantics(
          child: Text(
            emoji,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 48),
          ),
        ),
        const SizedBox(height: 16),
        Semantics(
          header: true,
          child: Text(
            title,
            textAlign: TextAlign.center,
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          message,
          textAlign: TextAlign.center,
          style: theme.textTheme.bodyLarge?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 24),
        PillSubmitButton(label: action, onPressed: onAction),
      ],
    );
  }
}
