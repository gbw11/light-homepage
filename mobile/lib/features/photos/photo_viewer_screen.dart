import 'package:flutter/material.dart';

import '../../core/paging/paged_list.dart';
import '../../core/ui/zoomable_image.dart';
import 'album.dart';
import 'photo_report_sheet.dart';
import 'photos_api.dart';

/// 크게 보기 — 좌우로 넘기기 · 두 손가락 확대 · ⋮ 신고 (기획안 §2-3 ③ M7).
///
/// 앨범 격자와 같은 [list]를 넘긴다. 끝에 가까워지면 다음 묶음을 받아 이어서
/// 넘길 수 있다. 하단 탭을 덮는 전체 화면이다.
class PhotoViewerScreen extends StatefulWidget {
  const PhotoViewerScreen({
    super.key,
    required this.photos,
    required this.list,
    required this.initialIndex,
    this.total,
  });

  final PhotosApi photos;
  final PagedList<Photo> list;
  final int initialIndex;

  /// 앨범의 전체 장 수. 모르면 받아 둔 장 수로 센다
  final int? total;

  @override
  State<PhotoViewerScreen> createState() => _PhotoViewerScreenState();
}

class _PhotoViewerScreenState extends State<PhotoViewerScreen> {
  late final _pages = PageController(initialPage: widget.initialIndex);
  late var _index = widget.initialIndex;
  var _zoomed = false;

  /// 끝에서 이만큼 남으면 다음 묶음을 받는다 — 넘기다 멈추지 않게
  static const _prefetch = 3;

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  void _onPageChanged(int i) {
    setState(() => _index = i);
    if (i >= widget.list.items.length - _prefetch) widget.list.loadMore();
  }

  Future<void> _report(Photo photo) async {
    final sent = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) =>
          PhotoReportSheet(photos: widget.photos, photoId: photo.id),
    );
    if (sent != true || !mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(const SnackBar(content: Text('요청이 접수됐어요.')));
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return ListenableBuilder(
      listenable: widget.list,
      builder: (context, _) {
        final items = widget.list.items;
        final current = _index < items.length ? items[_index] : null;
        final total = widget.total ?? items.length;
        return Scaffold(
          backgroundColor: scheme.onSurface,
          appBar: AppBar(
            backgroundColor: scheme.onSurface,
            foregroundColor: scheme.surface,
            title: Text('${_index + 1} / $total'),
            actions: [
              if (current != null)
                IconButton(
                  onPressed: () => _report(current),
                  tooltip: '사진 신고 · 삭제 요청',
                  icon: const Icon(Icons.more_vert),
                ),
            ],
          ),
          body: PageView.builder(
            controller: _pages,
            // 확대한 채로 끌면 넘기지 않고 사진 안을 움직인다
            physics: _zoomed
                ? const NeverScrollableScrollPhysics()
                : const PageScrollPhysics(),
            itemCount: items.length,
            onPageChanged: _onPageChanged,
            itemBuilder: (context, i) => ZoomableImage(
              // 새로고침으로 주소가 바뀌면 이미지를 새로 받게 한다
              key: ValueKey(items[i].viewUrl),
              image: NetworkImage(items[i].viewUrl),
              semanticLabel: '사진 ${i + 1}',
              active: i == _index,
              onZoomChanged: (z) => setState(() => _zoomed = z),
              // 주소(10분)가 만료됐다 — 목록을 다시 받으면 새 주소가 온다
              onReload: widget.list.refresh,
            ),
          ),
        );
      },
    );
  }
}
