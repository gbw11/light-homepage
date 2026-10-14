import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../content/location.dart';

// 약도 두 장 — 본당에서 걸어오는 길([RouteMap])과 주차장 세 곳에서 오는 길([ParkingMap]).
//
// 원본: frontend/src/components/ui/RouteMap.tsx (손으로 그린 SVG, viewBox 360×360).
// 좌표 · 글자 · 색 역할을 그대로 옮겼다 — 그림이 바뀌면 두 곳을 함께 고친다.
// 왜 지도 스크린샷이 아니라 직접 그린 그림인지(지도 라이선스), 좌표를 어디서
// 확인했는지는 웹 파일 주석에 있다. 이 그림은 **축척이 아니라 순서**를 보여준다.
//
// 새 패키지(flutter_svg)를 들이지 않고 [CustomPainter]로 그린다 — 도형이 선 ·
// 상자 · 원 · 글자뿐이라 SVG 파서까지 필요 없고, 색을 테마에서 바로 받는다.
//
// 색은 웹 토큰을 앱 색 역할로 옮겼다:
// `--color-gray-400` → onSurfaceVariant, `--color-ink` → onSurface,
// `--color-red-500` → error, `--color-yellow`(강조) → primary.

/// 약도 그림이 쓰는 좌표 공간 (웹 SVG viewBox와 같다)
const _canvas = 360.0;

/// 스크린 리더가 그림 대신 읽는 문장 (웹 `<desc>` 그대로)
const routeMapDescription =
    '김해교회 본당 앞에서 남쪽으로 95미터 내려가면 김해합성초등학교 남쪽 모퉁이가 '
    '나옵니다. 거기서 오른쪽(서쪽)으로 가락로를 따라 39미터 가면 왼편이 드림센터입니다. '
    '청년예배는 4층입니다. 전체 134미터, 도보 2분입니다.';

const parkingMapDescription =
    '드림센터에 가장 가까운 곳은 3주차장(합성초 주차장)으로, 김해합성초등학교 안 남쪽에 '
    '있어 바로 내려오면 됩니다. 2주차장(농협 주차장)은 드림센터 남동쪽으로 가락로를 따라 '
    '서쪽으로 걸어옵니다. 1주차장(교회 건너편 주차장)은 본당 맞은편이라, 본당에서 걸어오는 '
    '길과 같게 남쪽으로 내려온 뒤 오른쪽으로 꺾습니다. 청년예배는 드림센터 4층입니다.';

/// 본당 → 드림센터 도보 약도. 정사각이다 — 길이 남북으로 길고 동서로 짧다
class RouteMap extends StatelessWidget {
  const RouteMap({super.key});

  @override
  Widget build(BuildContext context) => _MapCanvas(
    label: '본당에서 드림센터까지 가는 약도. $routeMapDescription',
    painterFor: (p) => _RouteMapPainter(p),
  );
}

/// 주차장 세 곳(P1·P2·P3 — 교회 공식 번호 그대로)에서 드림센터로 가는 약도
class ParkingMap extends StatelessWidget {
  const ParkingMap({super.key});

  @override
  Widget build(BuildContext context) => _MapCanvas(
    label: '주차장 세 곳에서 드림센터로 가는 약도. $parkingMapDescription',
    painterFor: (p) => _ParkingMapPainter(p),
  );
}

class _MapCanvas extends StatelessWidget {
  const _MapCanvas({required this.label, required this.painterFor});

  final String label;
  final CustomPainter Function(_Palette) painterFor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final palette = _Palette(
      gray: scheme.onSurfaceVariant,
      ink: scheme.onSurface,
      red: scheme.error,
      accent: scheme.primary,
      onAccent: scheme.onPrimary,
      font: theme.textTheme.bodyMedium?.fontFamily,
    );
    return Semantics(
      image: true,
      label: label,
      excludeSemantics: true,
      child: AspectRatio(
        aspectRatio: 1,
        child: CustomPaint(painter: painterFor(palette)),
      ),
    );
  }
}

@immutable
class _Palette {
  const _Palette({
    required this.gray,
    required this.ink,
    required this.red,
    required this.accent,
    required this.onAccent,
    required this.font,
  });

  final Color gray;
  final Color ink;
  final Color red;
  final Color accent;
  final Color onAccent;
  final String? font;

  @override
  bool operator ==(Object other) =>
      other is _Palette &&
      other.gray == gray &&
      other.ink == ink &&
      other.red == red &&
      other.accent == accent &&
      other.onAccent == onAccent &&
      other.font == font;

  @override
  int get hashCode => Object.hash(gray, ink, red, accent, onAccent, font);
}

enum _Anchor { start, middle }

/// 두 약도가 공유하는 바닥 — 길 두 개, 학교, 드림센터, 북쪽 표시 (웹 `MapBase`)
abstract class _MapPainter extends CustomPainter {
  _MapPainter(this.p);

  final _Palette p;

  /// 드림센터 이름표의 가로 위치와 두 줄의 글자 밑선
  double get labelX => 140;
  double get titleY;
  double get floorY;

  void drawLayer(Canvas canvas);

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / _canvas, size.height / _canvas);
    _drawBase(canvas);
    drawLayer(canvas);
    canvas.restore();
  }

  void _drawBase(Canvas canvas) {
    // 길 — 겹치는 곳이 진해지지 않게 한 경로로 긋는다 (웹은 <g opacity>)
    canvas.drawPath(
      Path()
        ..moveTo(250, 60)
        ..lineTo(250, 248)
        ..moveTo(84, 248)
        ..lineTo(316, 248),
      Paint()
        ..color = p.gray.withValues(alpha: 0.28)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 26
        ..strokeCap = StrokeCap.round,
    );

    // 김해합성초등학교 — 걷는 내내 옆에 보이는 기준점
    canvas.drawRRect(
      RRect.fromLTRBR(62, 86, 208, 190, const Radius.circular(10)),
      Paint()..color = p.gray.withValues(alpha: 0.13),
    );

    text(canvas, '가락로', 318, 274, size: 16, color: p.gray);

    // 도착 — 강조 원 + 별
    canvas.drawCircle(const Offset(140, 248), 17, Paint()..color = p.accent);
    canvas.drawPath(
      _star(const Offset(140, 248.5), 8.5, 3.6),
      Paint()..color = p.onAccent,
    );

    text(canvas, '드림센터', labelX, titleY, size: 21, bold: true, color: p.ink);
    text(canvas, '4층', labelX, floorY, size: 18, bold: true, color: p.red);

    // 북쪽 표시
    canvas.save();
    canvas.translate(34, 40);
    canvas.drawPath(
      Path()
        ..moveTo(0, 14)
        ..lineTo(7, -6)
        ..lineTo(14, 14)
        ..lineTo(7, 8)
        ..close(),
      Paint()..color = p.gray,
    );
    text(canvas, 'N', 7, 34, size: 15, bold: true, color: p.gray);
    canvas.restore();
  }

  /// 글자 한 줄. [y]는 SVG처럼 **글자 밑선**이다
  void text(
    Canvas canvas,
    String value,
    double x,
    double y, {
    required double size,
    required Color color,
    bool bold = false,
    _Anchor anchor = _Anchor.middle,
  }) {
    final painter = TextPainter(
      text: TextSpan(
        text: value,
        style: TextStyle(
          fontFamily: p.font,
          fontSize: size,
          fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
          color: color,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    final baseline = painter.computeDistanceToActualBaseline(
      TextBaseline.alphabetic,
    );
    final left = anchor == _Anchor.middle ? x - painter.width / 2 : x;
    painter.paint(canvas, Offset(left, y - baseline));
    painter.dispose();
  }

  /// 빨간 점선 경로 — "이렇게 가라"
  void dashed(
    Canvas canvas,
    Path path, {
    required double width,
    required double dash,
    required double gap,
  }) {
    final paint = Paint()
      ..color = p.red
      ..style = PaintingStyle.stroke
      ..strokeWidth = width
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    for (final metric in path.computeMetrics()) {
      var d = 0.0;
      while (d < metric.length) {
        canvas.drawPath(
          metric.extractPath(d, math.min(d + dash, metric.length)),
          paint,
        );
        d += dash + gap;
      }
    }
  }

  static Path _star(Offset c, double outer, double inner) {
    final path = Path();
    for (var i = 0; i < 10; i++) {
      final r = i.isEven ? outer : inner;
      final a = -math.pi / 2 + i * math.pi / 5;
      final pt = c + Offset(r * math.cos(a), r * math.sin(a));
      i == 0 ? path.moveTo(pt.dx, pt.dy) : path.lineTo(pt.dx, pt.dy);
    }
    return path..close();
  }

  @override
  bool shouldRepaint(covariant _MapPainter old) => old.p != p;
}

class _RouteMapPainter extends _MapPainter {
  _RouteMapPainter(super.p);

  @override
  double get titleY => 212;
  @override
  double get floorY => 292;

  @override
  void drawLayer(Canvas canvas) {
    text(canvas, '김해합성', 135, 132, size: 19, bold: true, color: p.gray);
    text(canvas, '초등학교', 135, 158, size: 19, bold: true, color: p.gray);

    dashed(
      canvas,
      Path()
        ..moveTo(250, 60)
        ..lineTo(250, 248)
        ..lineTo(140, 248),
      width: 5,
      dash: 11,
      gap: 9,
    );

    text(
      canvas,
      '95m',
      272,
      166,
      size: 18,
      bold: true,
      color: p.red,
      anchor: _Anchor.start,
    );
    text(canvas, '39m', 204, 228, size: 18, bold: true, color: p.red);

    canvas.drawCircle(const Offset(250, 60), 13, Paint()..color = p.gray);
    text(
      canvas,
      '본당',
      272,
      50,
      size: 20,
      bold: true,
      color: p.ink,
      anchor: _Anchor.start,
    );
    text(
      canvas,
      '김해교회',
      272,
      72,
      size: 16,
      color: p.gray,
      anchor: _Anchor.start,
    );

    text(
      canvas,
      '도보 $walkMinutes분 · ${walkMeters}m',
      180,
      342,
      size: 19,
      bold: true,
      color: p.ink,
    );
  }
}

class _ParkingMapPainter extends _MapPainter {
  _ParkingMapPainter(super.p);

  // P3에서 내려오는 점선이 이름표 오른쪽 끝을 가로지르지 않게 왼쪽으로 민다
  @override
  double get labelX => 104;
  @override
  double get titleY => 214;
  @override
  double get floorY => 292;

  @override
  void drawLayer(Canvas canvas) {
    text(canvas, '김해합성', 105, 116, size: 18, bold: true, color: p.gray);
    text(canvas, '초등학교', 105, 138, size: 18, bold: true, color: p.gray);

    // 세 갈래. P1 — 본당 쪽으로 건너와 걷는 길을 그대로 / P3 — 학교 안에서
    // 바로 내려온다 / P2 — 가락로 남쪽에서 비스듬히 올라붙는다
    dashed(
      canvas,
      Path()
        ..moveTo(272, 61)
        ..lineTo(250, 61)
        ..lineTo(250, 248)
        ..lineTo(140, 248)
        ..moveTo(176, 174)
        ..lineTo(176, 248)
        ..lineTo(140, 248)
        ..moveTo(232, 303)
        ..lineTo(196, 303)
        ..lineTo(162, 264),
      width: 4.5,
      dash: 10,
      gap: 8,
    );

    // 본당은 위치만 알려준다 — 여기서는 출발점이 아니다
    canvas.drawRRect(
      RRect.fromLTRBR(196, 44, 248, 78, const Radius.circular(7)),
      Paint()..color = p.gray.withValues(alpha: 0.22),
    );
    text(canvas, '본당', 222, 66, size: 16, bold: true, color: p.gray);

    _parkingBox(canvas, 272, 44, 'P1');
    _parkingBox(canvas, 150, 140, 'P3');
    _parkingBox(canvas, 232, 286, 'P2');
    text(canvas, '농협주차장', 258, 340, size: 17, bold: true, color: p.gray);
  }

  void _parkingBox(Canvas canvas, double x, double y, String label) {
    final box = RRect.fromLTRBR(x, y, x + 52, y + 34, const Radius.circular(7));
    canvas.drawRRect(box, Paint()..color = p.gray.withValues(alpha: 0.22));
    canvas.drawRRect(
      box,
      Paint()
        ..color = p.gray
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );
    text(canvas, label, x + 26, y + 24, size: 19, bold: true, color: p.ink);
  }
}

/// 약도 한 장 — 판 위에 그림, 누르면 전체 화면에서 두 손가락으로 확대
class MapFigure extends StatelessWidget {
  const MapFigure({super.key, required this.title, required this.map});

  /// 전체 화면 제목 (예: "걸어서 — 본당에서 오는 길")
  final String title;
  final Widget map;

  void _open(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => _MapViewer(title: title, map: map),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      button: true,
      hint: '두 번 눌러 크게 보기',
      child: Material(
        color: scheme.surfaceContainer,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: scheme.outlineVariant),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => _open(context),
          child: Stack(
            children: [
              Padding(padding: const EdgeInsets.all(10), child: map),
              Positioned(
                right: 8,
                bottom: 8,
                child: ExcludeSemantics(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: scheme.surface.withValues(alpha: 0.9),
                      shape: BoxShape.circle,
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(6),
                      child: Icon(
                        Icons.zoom_in,
                        size: 20,
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MapViewer extends StatelessWidget {
  const _MapViewer({required this.title, required this.map});

  final String title;
  final Widget map;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      backgroundColor: scheme.surfaceContainer,
      appBar: AppBar(title: Text(title)),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: InteractiveViewer(
                maxScale: 5,
                child: Center(
                  child: Padding(padding: const EdgeInsets.all(16), child: map),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
              child: Text(
                '두 손가락으로 벌려 확대할 수 있어요.',
                textAlign: TextAlign.center,
                style: TextStyle(color: scheme.onSurfaceVariant),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
