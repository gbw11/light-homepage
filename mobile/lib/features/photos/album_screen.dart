import 'package:flutter/material.dart';

import '../../core/api/api_error.dart';
import '../../core/paging/paged_list.dart';
import '../../core/ui/paged_grid_view.dart';
import '../../core/ui/signed_image.dart';
import '../account/login_gate.dart';
import 'album.dart';
import 'photo_viewer_screen.dart';
import 'photos_api.dart';

/// 한 번에 받는 사진 수 — 3열 × 10줄. 썸네일 하나가 80KB 남짓이다
const _pageSize = 30;

/// 앨범 안 — 3열 격자, 끝까지 내리면 더 (커서 페이징, 기획안 §2-3 ③ M7).
///
/// 사진을 누르면 크게 보기가 하단 탭을 덮고 열린다. 크게 보기는 이 격자와
/// **같은 목록**을 넘긴다 — 끝까지 넘기면 격자에도 다음 사진이 채워진다.
/// 다운로드 버튼은 두지 않는다 (웹도 09-10에 뺐다).
class AlbumScreen extends StatefulWidget {
  const AlbumScreen({
    super.key,
    required this.photos,
    required this.albumId,
    required this.album,
    required this.onLogin,
  });

  final PhotosApi photos;
  final String albumId;

  /// 목록에서 넘겨받은 앨범. 주소로 바로 열면(딥링크) 없다 — 앨범 하나를 주는
  /// API가 없어서 제목만 비운다
  final Album? album;
  final VoidCallback onLogin;

  @override
  State<AlbumScreen> createState() => _AlbumScreenState();
}

class _AlbumScreenState extends State<AlbumScreen> {
  late final _list = PagedList<Photo>(
    () => CursorPageSource(
      (cursor) =>
          widget.photos.photos(widget.albumId, cursor: cursor, size: _pageSize),
    ),
  )..loadMore();

  @override
  void dispose() {
    _list.dispose();
    super.dispose();
  }

  void _openViewer(int index) {
    Navigator.of(context, rootNavigator: true).push(
      MaterialPageRoute<void>(
        builder: (_) => PhotoViewerScreen(
          photos: widget.photos,
          list: _list,
          initialIndex: index,
          total: widget.album?.photoCount,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.album?.title ?? '사진첩',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      body: ListenableBuilder(
        listenable: _list,
        builder: (context, _) {
          final error = _list.error;
          if (_list.items.isEmpty &&
              error is ApiError &&
              error.code == ErrorCode.unauthorized) {
            return LoginGate(onLogin: widget.onLogin);
          }
          return PagedGridView<Photo>(
            list: _list,
            onRefresh: _list.refresh,
            emptyMessage: '아직 올라온 사진이 없어요.',
            itemBuilder: (context, photo, index) => InkWell(
              onTap: () => _openViewer(index),
              child: SignedImage(
                url: photo.thumbUrl,
                semanticLabel: '사진 ${index + 1}',
                onExpired: _list.refresh,
              ),
            ),
          );
        },
      ),
    );
  }
}
