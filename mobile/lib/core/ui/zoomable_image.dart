import 'package:flutter/material.dart';

/// 크게 보기 한 장 — 두 손가락으로 확대, 두 번 눌러 확대/원래대로.
///
/// 좌우로 넘기는 뷰어([PageView]) 안에서 쓴다. 확대한 채로 끌면 넘기기가 아니라
/// 이미지 안을 움직여야 하므로 확대 여부를 [onZoomChanged]로 알린다 — 뷰어가
/// 그동안 넘기기를 멈춘다. 다른 장으로 넘어가면([active]가 false) 원래 크기로 돌린다.
class ZoomableImage extends StatefulWidget {
  const ZoomableImage({
    super.key,
    required this.image,
    required this.semanticLabel,
    required this.active,
    required this.onZoomChanged,
    required this.onReload,
    this.onLight = false,
  });

  /// 주보 · 사진은 서명된 주소([NetworkImage]), 월례회는 앱이 받아 둔 바이트([MemoryImage])
  final ImageProvider image;
  final String semanticLabel;
  final bool active;
  final ValueChanged<bool> onZoomChanged;

  /// 못 불러왔을 때 [다시 불러오기] — 주소가 만료됐으면 새 주소를 받아 온다
  final VoidCallback onReload;

  /// 밝은 바탕(흰 카드) 위에 둘 때 — 불러오는 표시 · 실패 안내를 어두운 색으로.
  /// 기본은 어두운 전체 화면 뷰어(사진첩 · 월례회)라 밝은 색이다
  final bool onLight;

  @override
  State<ZoomableImage> createState() => _ZoomableImageState();
}

class _ZoomableImageState extends State<ZoomableImage> {
  final _transform = TransformationController();
  TapDownDetails? _doubleTap;
  var _zoomed = false;

  static const _doubleTapScale = 2.5;

  @override
  void didUpdateWidget(ZoomableImage old) {
    super.didUpdateWidget(old);
    if (old.active && !widget.active) _reset();
  }

  @override
  void dispose() {
    _transform.dispose();
    super.dispose();
  }

  void _setZoomed(bool zoomed) {
    if (zoomed == _zoomed) return;
    _zoomed = zoomed;
    widget.onZoomChanged(zoomed);
  }

  void _reset() {
    _transform.value = Matrix4.identity();
    _setZoomed(false);
  }

  void _toggleZoom() {
    if (_zoomed) {
      _reset();
      return;
    }
    // 누른 곳을 중심으로 키운다
    final at = _doubleTap?.localPosition ?? Offset.zero;
    _transform.value = Matrix4.identity()
      ..translateByDouble(
        -at.dx * (_doubleTapScale - 1),
        -at.dy * (_doubleTapScale - 1),
        0,
        1,
      )
      ..scaleByDouble(_doubleTapScale, _doubleTapScale, 1, 1);
    _setZoomed(true);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final ink = widget.onLight ? scheme.onSurface : scheme.surface;
    return GestureDetector(
      onDoubleTapDown: (d) => _doubleTap = d,
      onDoubleTap: _toggleZoom,
      child: InteractiveViewer(
        transformationController: _transform,
        minScale: 1,
        maxScale: 5,
        onInteractionEnd: (_) =>
            _setZoomed(_transform.value.getMaxScaleOnAxis() > 1.01),
        child: Center(
          child: Image(
            image: widget.image,
            fit: BoxFit.contain,
            semanticLabel: widget.semanticLabel,
            loadingBuilder: (context, child, progress) {
              if (progress == null) return child;
              final total = progress.expectedTotalBytes;
              return CircularProgressIndicator(
                color: ink,
                value: total == null
                    ? null
                    : progress.cumulativeBytesLoaded / total,
              );
            },
            errorBuilder: (context, _, _) => Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.broken_image_outlined, color: ink),
                const SizedBox(height: 8),
                Text('이미지를 불러오지 못했어요.', style: TextStyle(color: ink)),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: widget.onReload,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: ink,
                    side: BorderSide(color: ink),
                  ),
                  child: const Text('다시 불러오기'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
