import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// 입력 화면이 함께 쓰는 모양 — 흰 카드 안에 굵은 이름표(✱) · 채운 입력칸
/// (왼쪽 아이콘) · 끝이 둥근 큰 버튼(→).
///
/// 로그인 · 회원가입 · 새가족 등록이 쓴다. 비밀번호 변경 · 내 정보는 아직 기본 모양이다.

/// 크림 바탕 위에 뜨는 흰 판. 정한 색 토큰(AppColors)에 흰색이 따로 없어
/// `onPrimary`(흰색)를 쓴다 — 바탕(크림)과 입력칸(베이지) 사이의 단계다
class FormCard extends StatelessWidget {
  const FormCard({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.onPrimary,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: scheme.onSurface.withValues(alpha: 0.06),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(padding: const EdgeInsets.all(20), child: child),
    );
  }
}

/// 칸 위 굵은 이름표. [isRequired]면 뒤에 빨간 ✱
class FieldLabel extends StatelessWidget {
  const FieldLabel(this.label, {super.key, this.isRequired = true});

  final String label;
  final bool isRequired;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final style = theme.textTheme.titleSmall?.copyWith(
      fontWeight: FontWeight.w700,
    );
    return Row(
      children: [
        Flexible(child: Text(label, style: style)),
        // 꼭 넣어야 하는 칸 — 모양만이다. 빈칸은 각 칸의 검사가 알린다
        if (isRequired)
          ExcludeSemantics(
            child: Text(
              ' *',
              style: style?.copyWith(color: theme.colorScheme.error),
            ),
          ),
      ],
    );
  }
}

/// 채운 입력칸의 꾸밈 — 베이지 바탕 · 둥근 모서리 · 왼쪽 아이콘. 고르면 초록 테두리.
/// 글 칸([CardField])과 고르는 칸(드롭다운)이 같이 쓴다
InputDecoration cardInputDecoration(
  BuildContext context, {
  IconData? icon,
  String? hint,
  String? helper,
  Widget? suffix,
}) {
  final theme = Theme.of(context);
  final scheme = theme.colorScheme;
  OutlineInputBorder border([Color? color]) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(14),
    borderSide: color == null
        ? BorderSide.none
        : BorderSide(color: color, width: 1.5),
  );
  return InputDecoration(
    hintText: hint,
    // 예시(2001-03-14)가 넣은 값처럼 보이지 않게 옅게
    hintStyle: theme.textTheme.bodyLarge?.copyWith(
      color: scheme.onSurfaceVariant.withValues(alpha: 0.55),
    ),
    helperText: helper,
    helperMaxLines: 2,
    errorMaxLines: 3,
    filled: true,
    fillColor: scheme.surfaceContainer,
    prefixIcon: icon == null
        ? null
        : Icon(icon, color: scheme.onSurfaceVariant),
    suffixIcon: suffix,
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    border: border(),
    enabledBorder: border(),
    focusedBorder: border(scheme.primary),
    errorBorder: border(scheme.error),
    focusedErrorBorder: border(scheme.error),
  );
}

/// 이름표 + 글 칸. 스크린리더에는 이름표와 칸이 한 덩어리로 읽힌다
class CardField extends StatelessWidget {
  const CardField({
    super.key,
    required this.label,
    required this.controller,
    this.icon,
    this.isRequired = true,
    this.hint,
    this.helper,
    this.focusNode,
    this.obscureText = false,
    this.suffix,
    this.keyboardType,
    this.inputFormatters,
    this.textInputAction,
    this.autofillHints,
    this.autocorrect = true,
    this.minLines,
    this.maxLines = 1,
    this.onSubmitted,
    this.onChanged,
    this.validator,
    this.errorText,
  });

  final String label;
  final TextEditingController controller;

  /// 칸 왼쪽 아이콘 — 여러 줄 칸은 없이 둔다
  final IconData? icon;

  /// 꼭 넣어야 하는 칸이면 이름표 뒤에 ✱
  final bool isRequired;
  final String? hint;

  /// 칸 아래 작은 설명 (오류가 나면 오류가 대신 선다)
  final String? helper;
  final FocusNode? focusNode;
  final bool obscureText;
  final Widget? suffix;
  final TextInputType? keyboardType;
  final List<TextInputFormatter>? inputFormatters;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofillHints;
  final bool autocorrect;
  final int? minLines;
  final int? maxLines;
  final ValueChanged<String>? onSubmitted;

  /// 사람이 칸을 고칠 때마다 (코드가 바꾼 것은 오지 않는다)
  final ValueChanged<String>? onChanged;
  final FormFieldValidator<String>? validator;

  /// 서버가 짚은 오류 (아이디 중복 등)
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    return MergeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          FieldLabel(label, isRequired: isRequired),
          const SizedBox(height: 8),
          TextFormField(
            controller: controller,
            focusNode: focusNode,
            obscureText: obscureText,
            keyboardType: keyboardType,
            inputFormatters: inputFormatters,
            textInputAction: textInputAction,
            autofillHints: autofillHints,
            autocorrect: autocorrect,
            enableSuggestions: autocorrect,
            minLines: minLines,
            maxLines: maxLines,
            onFieldSubmitted: onSubmitted,
            onChanged: onChanged,
            validator: validator,
            forceErrorText: errorText,
            decoration: cardInputDecoration(
              context,
              icon: icon,
              hint: hint,
              helper: helper,
              suffix: suffix,
            ),
          ),
        ],
      ),
    );
  }
}

/// 비밀번호 보기 · 숨기기 (칸 오른쪽 눈)
class PasswordVisibilityButton extends StatelessWidget {
  const PasswordVisibilityButton({
    super.key,
    required this.hidden,
    required this.onToggle,
  });

  final bool hidden;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onToggle,
      tooltip: hidden ? '비밀번호 보기' : '비밀번호 숨기기',
      icon: Icon(
        hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined,
      ),
    );
  }
}

/// 「로그인하기 →」 — 끝이 둥근 큰 버튼. 보내는 중이면 [busyLabel]로 바뀌고 눌리지 않는다
class PillSubmitButton extends StatelessWidget {
  const PillSubmitButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.busy = false,
    this.busyLabel,
  });

  final String label;

  /// null이면 눌리지 않는다 (동의 전 등)
  final VoidCallback? onPressed;
  final bool busy;
  final String? busyLabel;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return FilledButton(
      onPressed: busy ? null : onPressed,
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(56),
        shape: const StadiumBorder(),
        textStyle: theme.textTheme.titleMedium?.copyWith(
          fontWeight: FontWeight.w700,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Flexible(child: Text(busy ? (busyLabel ?? label) : label)),
          if (!busy) ...[
            const SizedBox(width: 8),
            const Icon(Icons.arrow_forward, size: 20),
          ],
        ],
      ),
    );
  }
}

/// 카드 아래 오류 한 줄 (서버가 칸을 짚지 않은 오류)
class FormErrorText extends StatelessWidget {
  const FormErrorText(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Semantics(
      liveRegion: true,
      child: Text(
        '⚠ $text',
        style: theme.textTheme.bodyMedium?.copyWith(
          color: theme.colorScheme.error,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
