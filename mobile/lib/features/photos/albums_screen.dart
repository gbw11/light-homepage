import 'package:flutter/material.dart';

import '../../core/api/api_error.dart';
import '../../core/format/date_format.dart';
import '../../core/paging/paged_list.dart';
import '../../core/ui/list_card.dart';
import '../../core/ui/paged_list_view.dart';
import '../../core/ui/signed_image.dart';
import '../account/login_gate.dart';
import 'album.dart';
import 'photos_api.dart';

/// 사진첩 — 앨범 목록 (웹 `/photos`, WIREFRAME §13, 기획안 §2-3 ③ M7).
///
/// 대표 사진 · 제목 · 날짜 · 장 수. 앨범 만들기 · 올리기 · 지우기는 앱에 두지 않는다
/// — 웹에서 한다 (기획안 §1).
class AlbumsScreen extends StatefulWidget {
  const AlbumsScreen({
    super.key,
    required this.photos,
    required this.onOpen,
    required this.onLogin,
  });

  final PhotosApi photos;
  final void Function(Album album) onOpen;
  final VoidCallback onLogin;

  @override
  State<AlbumsScreen> createState() => _AlbumsScreenState();
}

class _AlbumsScreenState extends State<AlbumsScreen> {
  late final _list = PagedList<Album>(
    () => NumberedPageSource((page) => widget.photos.albums(page: page)),
  )..loadMore();

  @override
  void dispose() {
    _list.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('사진첩', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: ListenableBuilder(
        listenable: _list,
        builder: (context, _) {
          // 보는 사이 세션이 끊겼다 — 목록 대신 로그인 안내
          final error = _list.error;
          if (_list.items.isEmpty &&
              error is ApiError &&
              error.code == ErrorCode.unauthorized) {
            return LoginGate(onLogin: widget.onLogin);
          }
          return PagedListView<Album>(
            list: _list,
            onRefresh: _list.refresh,
            emptyMessage: '아직 올라온 앨범이 없어요.',
            cards: true,
            itemBuilder: (context, album) => _AlbumCard(
              album,
              onTap: () => widget.onOpen(album),
              onExpired: _list.refresh,
            ),
          );
        },
      ),
    );
  }
}

/// 앨범 한 장 — 위에 대표 사진(16:9), 아래 [사진첩] [🖼 N장] ··· 날짜 / 제목 / 앨범 보기 →
class _AlbumCard extends StatelessWidget {
  const _AlbumCard(this.album, {required this.onTap, required this.onExpired});

  final Album album;
  final VoidCallback onTap;
  final VoidCallback onExpired;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final date = album.eventDate;
    return ListCard(
      onTap: onTap,
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AspectRatio(
            aspectRatio: 16 / 9,
            child: SignedImage(
              url: album.coverThumbUrl,
              semanticLabel: '${album.title} 대표 사진',
              onExpired: onExpired,
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          const ListChip('사진첩', strong: true),
                          ListChip(
                            '${album.photoCount}장',
                            icon: Icons.photo_outlined,
                          ),
                        ],
                      ),
                    ),
                    if (date != null)
                      Text(
                        formatYmd(date),
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  album.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 6),
                Align(
                  alignment: Alignment.centerRight,
                  child: ExcludeSemantics(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '앨범 보기',
                          style: theme.textTheme.labelLarge?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Icon(Icons.arrow_forward, size: 18),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
