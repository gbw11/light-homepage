import 'package:flutter/services.dart';

/// 숫자만 받아 정해진 자리마다 `-`를 넣는다 — 생년월일 `2001-03-14`,
/// 전화번호 `010-1234-5678`.
///
/// 서버는 이 모양만 받는다 (SPEC_API §2.1 — 생년월일 `YYYY-MM-DD`, 웹도 전화번호를
/// `010-0000-0000`으로 받는다). 휴대폰 숫자 자판에는 `-`가 없거나 찾기 어려워서
/// 사용자가 숫자만 누르면 모양이 갖춰지게 한다. 붙여넣은 `-` · 띄어쓰기도 걸러진다.
class DashedDigitsFormatter extends TextInputFormatter {
  const DashedDigitsFormatter(this.groups);

  /// 생년월일 `[4, 2, 2]` · 전화번호 `[3, 4, 4]`
  const DashedDigitsFormatter.birthDate() : groups = const [4, 2, 2];
  const DashedDigitsFormatter.phone() : groups = const [3, 4, 4];

  final List<int> groups;

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    var digits = newValue.text.replaceAll(RegExp(r'[^0-9]'), '');
    // 지우개로 `-` 바로 뒤를 지우면 숫자는 그대로라 `-`가 다시 생긴다 —
    // 그 앞 숫자까지 지운 것으로 본다
    final deletedDashOnly =
        newValue.text.length < oldValue.text.length &&
        digits == oldValue.text.replaceAll(RegExp(r'[^0-9]'), '');
    if (deletedDashOnly && digits.isNotEmpty) {
      digits = digits.substring(0, digits.length - 1);
    }

    final max = groups.fold(0, (sum, g) => sum + g);
    if (digits.length > max) digits = digits.substring(0, max);

    final out = StringBuffer();
    var at = 0;
    for (final (i, size) in groups.indexed) {
      if (at >= digits.length) break;
      if (i > 0) out.write('-');
      final end = (at + size).clamp(0, digits.length);
      out.write(digits.substring(at, end));
      at = end;
    }
    final text = out.toString();
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}
