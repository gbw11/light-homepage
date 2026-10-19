import 'package:flutter/material.dart';

import '../../core/api/api_error.dart';
import '../../core/format/birth_date.dart';
import '../../core/format/dashed_digits_formatter.dart';
import '../../core/ui/form_card.dart';
import '../../core/ui/status_views.dart';
import 'newcomers_api.dart';

/// 새가족 등록 (웹 `/welcome/register`, WIREFRAME §9, 기획안 §3 M12).
///
/// 칸 · 선택지 · 문구는 웹 폼과 같다 — 나이대 대신 생년월일을 받는 것만 다르다
/// (2026-10-19, SPEC_API §9.1). 필수는 이름 · 연락처 · 생년월일 · 개인정보 동의
/// 넷이고, **동의하기 전에는 [등록하기]가 눌리지 않는다.**
///
/// 모양은 로그인 화면과 같다 — 엠블럼 · 흰 카드 · 굵은 이름표(✱는 필수만) · 채운
/// 입력칸 · 끝이 둥근 큰 버튼 (`core/ui/form_card.dart`).
class NewcomerFormScreen extends StatefulWidget {
  const NewcomerFormScreen({
    super.key,
    required this.api,
    required this.onDirections,
  });

  final NewcomersApi api;

  /// 등록을 마친 뒤 [오시는 길 확인하기]
  final VoidCallback onDirections;

  @override
  State<NewcomerFormScreen> createState() => _NewcomerFormScreenState();
}

class _NewcomerFormScreenState extends State<NewcomerFormScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _birthDate = TextEditingController();
  final _message = TextEditingController();
  String? _gender;
  String? _referrer;
  var _agreed = false;

  var _submitting = false;
  var _done = false;

  /// 서버가 칸을 짚어 준 오류 (`VALIDATION_ERROR`의 `field`)
  String? _nameError;
  String? _phoneError;
  String? _birthDateError;

  /// 칸에 붙일 수 없는 오류 — 버튼 위에 둔다
  String? _formError;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _birthDate.dispose();
    _message.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _nameError = null;
      _phoneError = null;
      _birthDateError = null;
      _formError = null;
    });
    if (!_form.currentState!.validate()) return;

    setState(() => _submitting = true);
    try {
      final message = _message.text.trim();
      await widget.api.submit((
        name: _name.text.trim(),
        phone: _phone.text.trim(),
        birthDate: _birthDate.text.trim(),
        gender: _gender,
        referrer: _referrer,
        message: message.isEmpty ? null : message,
      ));
      if (mounted) setState(() => _done = true);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        switch (error) {
          case ApiError(code: ErrorCode.validationError, field: 'name'):
            _nameError = error.message;
          case ApiError(code: ErrorCode.validationError, field: 'phone'):
            _phoneError = error.message;
          case ApiError(code: ErrorCode.validationError, field: 'birthDate'):
            _birthDateError = error.message;
          // 검증 문구는 사람이 읽으라고 쓴 것이라 그대로 보인다
          case ApiError(code: ErrorCode.validationError):
            _formError = error.message;
          default:
            _formError = describeError(error);
        }
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          '새가족 등록',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 40),
        children: [
          const _Header(),
          const SizedBox(height: 20),
          FormCard(child: _done ? _doneView() : _formView()),
        ],
      ),
    );
  }

  Widget _formView() {
    final theme = Theme.of(context);
    return Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CardField(
            label: '이름',
            icon: Icons.person_outline,
            controller: _name,
            hint: '이름을 입력해 주세요',
            errorText: _nameError,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.name],
            validator: (v) => (v ?? '').trim().isEmpty ? '이름을 입력해주세요.' : null,
          ),
          const SizedBox(height: 16),
          CardField(
            label: '연락처',
            icon: Icons.phone_outlined,
            controller: _phone,
            hint: '010-1234-5678',
            errorText: _phoneError,
            keyboardType: TextInputType.phone,
            // 숫자만 눌러도 010-1234-5678 모양이 된다 (회원가입과 같다)
            inputFormatters: const [DashedDigitsFormatter.phone()],
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.telephoneNumber],
            validator: (v) => (v ?? '').trim().isEmpty ? '연락처를 입력해주세요.' : null,
          ),
          const SizedBox(height: 16),
          // 회원가입과 같은 입력 — 숫자만 누르면 2001-03-14 모양이 된다
          CardField(
            label: '생년월일',
            icon: Icons.cake_outlined,
            controller: _birthDate,
            hint: '2001-03-14',
            helper: '숫자만 누르면 돼요',
            errorText: _birthDateError,
            keyboardType: TextInputType.number,
            inputFormatters: const [DashedDigitsFormatter.birthDate()],
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.birthday],
            validator: (v) => isValidBirthDate((v ?? '').trim())
                ? null
                : '생년월일을 2001-03-14처럼 입력해 주세요.',
          ),
          const SizedBox(height: 16),
          const FieldLabel('성별', isRequired: false),
          const SizedBox(height: 8),
          _PillChoice(
            choices: genderChoices,
            value: _gender,
            onChanged: (v) => setState(() => _gender = v),
          ),
          const SizedBox(height: 16),
          const FieldLabel('어떻게 알게 되셨나요?', isRequired: false),
          const SizedBox(height: 8),
          _ChoiceField(
            icon: Icons.campaign_outlined,
            choices: referrerChoices,
            value: _referrer,
            onChanged: (v) => setState(() => _referrer = v),
          ),
          const SizedBox(height: 16),
          CardField(
            label: '남기고 싶은 말',
            isRequired: false,
            controller: _message,
            hint: '궁금한 점이나 하고 싶은 말을 자유롭게 남겨 주세요',
            minLines: 3,
            maxLines: 6,
            keyboardType: TextInputType.multiline,
          ),
          const SizedBox(height: 16),
          // 동의 — 베이지 판 안에 체크. 필수라 ✱를 단다
          // 바탕은 Material로 — DecoratedBox 위의 ListTile은 누른 물결이 가려진다
          Material(
            color: theme.colorScheme.surfaceContainer,
            borderRadius: BorderRadius.circular(14),
            child: CheckboxListTile(
              value: _agreed,
              onChanged: (v) => setState(() => _agreed = v ?? false),
              controlAffinity: ListTileControlAffinity.leading,
              contentPadding: const EdgeInsets.symmetric(horizontal: 8),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
              title: Text.rich(
                TextSpan(
                  children: [
                    const TextSpan(text: '개인정보 수집·이용 동의'),
                    TextSpan(
                      text: ' *',
                      style: TextStyle(color: theme.colorScheme.error),
                    ),
                  ],
                ),
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              subtitle: const Text(
                '수집 항목: 이름·연락처·생년월일. 목적: 새가족 안내. 보유 기간: 등록일로부터 1년.',
              ),
            ),
          ),
          if (_formError case final error?) ...[
            const SizedBox(height: 12),
            FormErrorText(error),
          ],
          const SizedBox(height: 20),
          PillSubmitButton(
            label: '등록하기',
            busyLabel: '등록 중...',
            busy: _submitting,
            onPressed: _agreed ? _submit : null,
          ),
        ],
      ),
    );
  }

  Widget _doneView() {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 8),
        Semantics(
          header: true,
          child: Text(
            '등록됐습니다 🎉',
            textAlign: TextAlign.center,
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          '주일에 뵙겠습니다.',
          textAlign: TextAlign.center,
          style: theme.textTheme.bodyLarge?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 24),
        PillSubmitButton(label: '오시는 길 확인하기', onPressed: widget.onDirections),
      ],
    );
  }
}

/// 엠블럼 + 한 줄 인사 (로그인 화면과 같은 자리)
class _Header extends StatelessWidget {
  const _Header();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      children: [
        Image.asset(
          'assets/images/logo.png',
          height: 96,
          // 꾸밈이다 — 화면 이름은 위 제목줄이 말한다
          excludeFromSemantics: true,
        ),
        const SizedBox(height: 12),
        Text(
          '미리 알려주시면 주일에 맞이하겠습니다.',
          textAlign: TextAlign.center,
          style: theme.textTheme.bodyLarge?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}

/// 알약 버튼으로 하나 고르기 (성별). 고른 것을 다시 누르면 "선택 안 함"으로 돌아간다
class _PillChoice extends StatelessWidget {
  const _PillChoice({
    required this.choices,
    required this.value,
    required this.onChanged,
  });

  final List<Choice> choices;
  final String? value;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Row(
      spacing: 8,
      children: [
        for (final c in choices)
          Expanded(
            child: Semantics(
              button: true,
              selected: value == c.wire,
              inMutuallyExclusiveGroup: true,
              child: Material(
                color: value == c.wire
                    ? scheme.primary
                    : scheme.surfaceContainer,
                shape: const StadiumBorder(),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: () => onChanged(value == c.wire ? null : c.wire),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: 48),
                    child: Center(
                      child: Text(
                        c.label,
                        style: theme.textTheme.titleSmall?.copyWith(
                          color: value == c.wire
                              ? scheme.onPrimary
                              : scheme.onSurface,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// 고르지 않아도 되는 선택 칸 — 맨 위가 "선택 안 함". 글 칸과 같은 채운 모양
class _ChoiceField extends StatelessWidget {
  const _ChoiceField({
    required this.icon,
    required this.choices,
    required this.value,
    required this.onChanged,
  });

  final IconData icon;
  final List<Choice> choices;
  final String? value;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String?>(
      initialValue: value,
      isExpanded: true,
      decoration: cardInputDecoration(context, icon: icon),
      borderRadius: BorderRadius.circular(14),
      items: [
        const DropdownMenuItem(value: null, child: Text('선택 안 함')),
        for (final c in choices)
          DropdownMenuItem(value: c.wire, child: Text(c.label)),
      ],
      onChanged: onChanged,
    );
  }
}
