import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../auth/auth_user.dart';
import '../format/date_format.dart';

/// 열람자 워터마크 문구 — 「이름 1234 · 2026.10.19 14:05 · #18」.
///
/// 월례회 페이지에 서버가 새기는 것과 같은 내용이다 (SPEC_API §7.3 —
/// 이름 · 연락처 뒷4자리 · 열람 시각 · 문서 번호). 사진으로 찍혀 밖에 돌아도
/// 누가 언제 연 화면인지 알 수 있게 한다.
///
/// 연락처가 없으면(로그인 직후 · 카카오 가입자) 뒷4자리를 뺀다 — 지어내지 않는다.
String watermarkText(AuthUser? user, DateTime viewedAt, {String? documentId}) {
  final digits = (user?.phone ?? '').replaceAll(RegExp(r'\D'), '');
  final last4 = digits.length >= 4 ? digits.substring(digits.length - 4) : null;
  final local = viewedAt.toLocal();
  final hh = local.hour.toString().padLeft(2, '0');
  final mm = local.minute.toString().padLeft(2, '0');
  return [
    [user?.name ?? 'LIGHT', ?last4].join(' '),
    '${formatDotDate(viewedAt)} $hh:$mm',
    if (documentId != null) '#$documentId',
  ].join(' · ');
}

/// [child] 위에 [text]를 반투명하게 사선으로 반복해서 깐다 (회의록 · 예산안, 2026-10-19).
///
/// - **화면에 고정된다** — 본문을 스크롤해도 제자리에 있어, 어느 부분을 찍어도 남는다
/// - 누르기 · 스크린 리더를 가로막지 않는다 (그리기만 한다)
/// - 본문보다 옅게 — 읽는 데 방해가 되지 않을 만큼만
///
/// 화면에 덧그리는 방식이라 **글자를 복사해 가는 것은 막지 못한다** — 그래서 쓰는
/// 쪽이 본문 선택(복사)을 함께 끈다. 캡처 · 녹화는 `SecureScreen`이 막는다.
class Watermark extends StatelessWidget {
  const Watermark({super.key, required this.text, required this.child});

  final String text;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final style = theme.textTheme.titleSmall!.copyWith(
      color: theme.colorScheme.onSurface.withValues(alpha: 0.09),
      fontWeight: FontWeight.w700,
    );
    return Stack(
      children: [
        child,
        Positioned.fill(
          child: IgnorePointer(
            child: ExcludeSemantics(
              child: RepaintBoundary(
                child: CustomPaint(
                  painter: _WatermarkPainter(
                    text: text,
                    style: style,
                    // 글자 크기 설정을 따른다 — 큰 글씨로 보는 사람에게 너무 작지 않게
                    textScaler: MediaQuery.textScalerOf(context),
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

class _WatermarkPainter extends CustomPainter {
  _WatermarkPainter({
    required this.text,
    required this.style,
    required this.textScaler,
  });

  final String text;
  final TextStyle style;
  final TextScaler textScaler;

  /// 사선 각도 — 아래에서 위로 30도
  static const _angle = -math.pi / 6;

  @override
  void paint(Canvas canvas, Size size) {
    final painter = TextPainter(
      text: TextSpan(text: text, style: style),
      textDirection: TextDirection.ltr,
      textScaler: textScaler,
    )..layout();

    final stepX = painter.width + 48;
    final stepY = painter.height + 72;
    // 기울여도 네 귀퉁이가 비지 않게 화면 대각선만큼 넓게 깐다
    final reach = math.sqrt(
      size.width * size.width + size.height * size.height,
    );

    canvas
      ..save()
      ..clipRect(Offset.zero & size)
      ..translate(size.width / 2, size.height / 2)
      ..rotate(_angle);
    var row = 0;
    for (var y = -reach; y < reach; y += stepY) {
      // 줄마다 반 칸씩 엇갈려 벽돌처럼 — 세로로 같은 자리에 뭉치지 않게
      final offset = row.isOdd ? stepX / 2 : 0.0;
      for (var x = -reach - offset; x < reach; x += stepX) {
        painter.paint(canvas, Offset(x, y));
      }
      row++;
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_WatermarkPainter old) =>
      old.text != text || old.style != style || old.textScaler != textScaler;
}
