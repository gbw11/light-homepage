import 'package:flutter/material.dart';

import '../../core/api/api_error.dart';
import '../../core/format/date_format.dart';
import '../../core/ui/status_views.dart';
import '../../core/ui/zoomable_image.dart';
import '../account/login_gate.dart';
import 'bulletin.dart';
import 'bulletins_api.dart';

/// 주보 보기 — 장 단위로 좌우로 넘기고, 두 손가락으로 확대한다 (기획안 §2-3 ②).
///
/// 하단 탭을 덮는 전체 화면이다. 주보는 흰 종이라 어두운 바탕에 올린다.
class BulletinViewerScreen extends StatefulWidget {
  const BulletinViewerScreen({
    super.key,
    required this.bulletins,
    required this.id,
    required this.onLogin,
  });

  final BulletinsApi bulletins;
  final String id;
  final VoidCallback onLogin;

  @override
  State<BulletinViewerScreen> createState() => _BulletinViewerScreenState();
}

class _BulletinViewerScreenState extends State<BulletinViewerScreen> {
  late Future<Bulletin> _bulletin = widget.bulletins.get(widget.id);
  final _pages = PageController();
  var _index = 0;
  var _zoomed = false;

  /// 주소(10분)가 만료됐으면 새로 받는다. 보던 장은 그대로다
  void _reload() {
    setState(() {
      _bulletin = widget.bulletins.get(widget.id);
    });
  }

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return FutureBuilder(
      future: _bulletin,
      builder: (context, snapshot) {
        final bulletin = snapshot.data;
        return Scaffold(
          backgroundColor: scheme.onSurface,
          appBar: AppBar(
            backgroundColor: scheme.onSurface,
            foregroundColor: scheme.surface,
            title: Text(
              bulletin == null ? '주보' : '${formatYmd(bulletin.serviceDate)} 주보',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          body: switch (snapshot) {
            AsyncSnapshot(connectionState: ConnectionState.waiting)
                when bulletin == null =>
              Center(child: CircularProgressIndicator(color: scheme.surface)),
            AsyncSnapshot(error: final error?) => ColoredBox(
              color: scheme.surface,
              child: switch (error) {
                ApiError(code: ErrorCode.unauthorized) => LoginGate(
                  onLogin: widget.onLogin,
                ),
                ApiError(code: ErrorCode.notFound) => const MessageView(
                  icon: Icons.search_off,
                  message: '찾을 수 없는 주보예요.',
                ),
                _ => ErrorView(error: error, onRetry: _reload),
              },
            ),
            _ => _Pages(
              bulletin!,
              controller: _pages,
              index: _index,
              zoomed: _zoomed,
              onPageChanged: (i) => setState(() => _index = i),
              onZoomChanged: (z) => setState(() => _zoomed = z),
              onReload: _reload,
            ),
          },
        );
      },
    );
  }
}

class _Pages extends StatelessWidget {
  const _Pages(
    this.bulletin, {
    required this.controller,
    required this.index,
    required this.zoomed,
    required this.onPageChanged,
    required this.onZoomChanged,
    required this.onReload,
  });

  final Bulletin bulletin;
  final PageController controller;
  final int index;
  final bool zoomed;
  final ValueChanged<int> onPageChanged;
  final ValueChanged<bool> onZoomChanged;
  final VoidCallback onReload;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final pages = bulletin.pages;
    if (pages.isEmpty) {
      return ColoredBox(
        color: scheme.surface,
        child: const MessageView(message: '이 주보에는 올라온 장이 없어요.'),
      );
    }
    return Stack(
      children: [
        PageView.builder(
          controller: controller,
          // 확대한 채로 끌면 넘기지 않고 장 안을 움직인다
          physics: zoomed
              ? const NeverScrollableScrollPhysics()
              : const PageScrollPhysics(),
          itemCount: pages.length,
          onPageChanged: onPageChanged,
          itemBuilder: (context, i) => ZoomableImage(
            image: NetworkImage(pages[i].url),
            semanticLabel: '주보 ${pages[i].pageNo}쪽',
            active: i == index,
            onZoomChanged: onZoomChanged,
            onReload: onReload,
          ),
        ),
        // "1 / 4" — 몇 장 중 몇 번째인지
        Positioned(
          left: 0,
          right: 0,
          bottom: 24,
          child: Center(
            child: Semantics(
              liveRegion: true,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: scheme.onSurface.withValues(alpha: 0.7),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 4,
                  ),
                  child: Text(
                    '${index + 1} / ${pages.length}',
                    style: TextStyle(
                      color: scheme.surface,
                      fontWeight: FontWeight.w600,
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
