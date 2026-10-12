import 'package:flutter/material.dart';

import '../../core/api/api_error.dart';
import '../../core/ui/status_views.dart';
import '../church/info_widgets.dart';
import 'newcomers_api.dart';

/// 새가족 등록 (웹 `/welcome/register`, WIREFRAME §9, 기획안 §3 M12).
///
/// 칸 · 선택지 · 문구는 웹 폼과 같다. 필수는 이름 · 연락처 · 개인정보 동의 셋이고,
/// **동의하기 전에는 [등록하기]가 눌리지 않는다.**
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
  final _message = TextEditingController();
  String? _gender;
  String? _ageGroup;
  String? _referrer;
  var _agreed = false;

  var _submitting = false;
  var _done = false;

  /// 서버가 칸을 짚어 준 오류 (`VALIDATION_ERROR`의 `field`)
  String? _nameError;
  String? _phoneError;

  /// 칸에 붙일 수 없는 오류 — 버튼 위에 둔다
  String? _formError;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _message.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _nameError = null;
      _phoneError = null;
      _formError = null;
    });
    if (!_form.currentState!.validate()) return;

    setState(() => _submitting = true);
    try {
      final message = _message.text.trim();
      await widget.api.submit((
        name: _name.text.trim(),
        phone: _phone.text.trim(),
        gender: _gender,
        ageGroup: _ageGroup,
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
    if (_done) return _Done(onDirections: widget.onDirections);

    final theme = Theme.of(context);
    final labelStyle = theme.textTheme.titleSmall?.copyWith(
      fontWeight: FontWeight.w700,
    );
    Widget label(String text) => Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(text, style: labelStyle),
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          '새가족 등록',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
          children: [
            const InfoText('미리 알려주시면 주일에 맞이하겠습니다.', muted: true),
            const SizedBox(height: 24),
            label('이름 *'),
            TextFormField(
              controller: _name,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.name],
              forceErrorText: _nameError,
              validator: (v) => (v ?? '').trim().isEmpty ? '이름을 입력해주세요.' : null,
            ),
            const SizedBox(height: 20),
            label('연락처 *'),
            TextFormField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.telephoneNumber],
              decoration: const InputDecoration(hintText: '010-1234-5678'),
              forceErrorText: _phoneError,
              validator: (v) =>
                  (v ?? '').trim().isEmpty ? '연락처를 입력해주세요.' : null,
            ),
            const SizedBox(height: 20),
            label('성별'),
            SegmentedButton<String>(
              segments: [
                for (final c in genderChoices)
                  ButtonSegment(value: c.wire, label: Text(c.label)),
              ],
              selected: {?_gender},
              // 고른 것을 다시 누르면 "선택 안 함"으로 돌아간다
              emptySelectionAllowed: true,
              showSelectedIcon: false,
              onSelectionChanged: (s) =>
                  setState(() => _gender = s.firstOrNull),
            ),
            const SizedBox(height: 20),
            label('나이대'),
            _ChoiceField(
              choices: ageGroupChoices,
              value: _ageGroup,
              onChanged: (v) => setState(() => _ageGroup = v),
            ),
            const SizedBox(height: 20),
            label('어떻게 알게 되셨나요?'),
            _ChoiceField(
              choices: referrerChoices,
              value: _referrer,
              onChanged: (v) => setState(() => _referrer = v),
            ),
            const SizedBox(height: 20),
            label('남기고 싶은 말'),
            TextFormField(
              controller: _message,
              minLines: 3,
              maxLines: 6,
              keyboardType: TextInputType.multiline,
            ),
            const SizedBox(height: 20),
            CheckboxListTile(
              value: _agreed,
              onChanged: (v) => setState(() => _agreed = v ?? false),
              controlAffinity: ListTileControlAffinity.leading,
              contentPadding: EdgeInsets.zero,
              title: const Text('개인정보 수집·이용 동의 *'),
              subtitle: const Text(
                '수집 항목: 이름·연락처. 목적: 새가족 안내. 보유 기간: 등록일로부터 1년.',
              ),
            ),
            if (_formError case final error?) ...[
              const SizedBox(height: 8),
              Text(
                error,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.error,
                ),
              ),
            ],
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _agreed && !_submitting ? _submit : null,
              child: Text(_submitting ? '등록 중...' : '등록하기'),
            ),
          ],
        ),
      ),
    );
  }
}

/// 고르지 않아도 되는 선택 칸 — 맨 위가 "선택 안 함"
class _ChoiceField extends StatelessWidget {
  const _ChoiceField({
    required this.choices,
    required this.value,
    required this.onChanged,
  });

  final List<Choice> choices;
  final String? value;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String?>(
      initialValue: value,
      isExpanded: true,
      items: [
        const DropdownMenuItem(value: null, child: Text('선택 안 함')),
        for (final c in choices)
          DropdownMenuItem(value: c.wire, child: Text(c.label)),
      ],
      onChanged: onChanged,
    );
  }
}

/// 등록을 마친 화면
class _Done extends StatelessWidget {
  const _Done({required this.onDirections});

  final VoidCallback onDirections;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          '새가족 등록',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(32),
          child: Column(
            children: [
              Text(
                '등록됐습니다 🎉',
                textAlign: TextAlign.center,
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
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
              FilledButton(
                onPressed: onDirections,
                child: const Text('오시는 길 확인하기'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
