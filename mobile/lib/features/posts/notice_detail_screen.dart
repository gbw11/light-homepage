import 'package:flutter/material.dart';

import '../../core/api/api_error.dart';
import '../../core/format/date_format.dart';
import '../../core/format/file_size.dart';
import '../../core/ui/status_views.dart';
import 'post_body_view.dart';
import 'post_detail.dart';
import 'posts_api.dart';

/// 공지 상세 (웹 `/news/[slug]`, 기획안 §2-2 ②).
///
/// 회의록·예산안 상세(M9)도 같은 모양이라 [title]만 바꿔 쓸 수 있게 둔다.
class NoticeDetailScreen extends StatefulWidget {
  const NoticeDetailScreen({
    super.key,
    required this.posts,
    required this.idOrSlug,
    required this.openExternal,
    this.title = '공지',
  });

  final PostsApi posts;
  final String idOrSlug;

  /// 본문 링크와 첨부파일을 바깥 앱(브라우저 등)으로 연다
  final Future<void> Function(String url) openExternal;

  /// 화면 위 제목 — 글 제목이 아니라 글의 종류
  final String title;

  @override
  State<NoticeDetailScreen> createState() => _NoticeDetailScreenState();
}

class _NoticeDetailScreenState extends State<NoticeDetailScreen> {
  late Future<PostDetail> _post = widget.posts.get(widget.idOrSlug);

  /// 주소를 받는 중인 첨부. 두 번 누르면 두 번 열리지 않게 막는다
  String? _opening;

  void _retry() {
    setState(() {
      _post = widget.posts.get(widget.idOrSlug);
    });
  }

  /// 첨부 열기 — 권한이 실린 요청으로 서명 주소를 받고, 그 주소를 바깥에서 연다.
  ///
  /// 웹은 링크(`/api/files/{id}`)를 브라우저가 직접 따라가게 했다. 앱에서
  /// 그 주소를 바깥 브라우저로 넘기면 **로그인 쿠키가 없어** 회원 공지의 첨부가
  /// 404가 된다 (기획안 §2-2 ⚠️). 그래서 앱이 먼저 묻고, 받은 주소만 넘긴다.
  Future<void> _openAttachment(Attachment attachment) async {
    if (_opening != null) return;
    setState(() => _opening = attachment.id);
    try {
      final url = await widget.posts.attachmentUrl(attachment.id);
      await widget.openExternal(url.toString());
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(_attachmentError(error))));
    } finally {
      if (mounted) setState(() => _opening = null);
    }
  }

  String _attachmentError(Object error) => switch (error) {
    ApiError(code: ErrorCode.notFound) => '파일을 찾을 수 없어요. 글이 바뀌었을 수 있어요.',
    ApiError(code: ErrorCode.unauthorized) => '로그인하면 받을 수 있어요.',
    _ => describeError(error),
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.title,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      body: FutureBuilder(
        future: _post,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const LoadingView();
          }
          if (snapshot.error case final error?) {
            return switch (error) {
              // 없는 글과 권한 없는 글은 서버가 똑같이 404로 준다 (존재를 숨김)
              ApiError(code: ErrorCode.notFound) => const MessageView(
                icon: Icons.search_off,
                message: '찾을 수 없는 글입니다.\n지워졌거나 주소가 바뀌었을 수 있어요.',
              ),
              // 로그인 화면(묶음 A)이 생기면 여기에 [로그인]을 단다
              ApiError(code: ErrorCode.unauthorized || ErrorCode.forbidden) =>
                const MessageView(
                  icon: Icons.lock_outline,
                  message: '로그인하면 볼 수 있어요.',
                ),
              _ => ErrorView(error: error, onRetry: _retry),
            };
          }
          return _Content(
            snapshot.requireData,
            opening: _opening,
            onOpenLink: widget.openExternal,
            onOpenAttachment: _openAttachment,
          );
        },
      ),
    );
  }
}

class _Content extends StatelessWidget {
  const _Content(
    this.post, {
    required this.opening,
    required this.onOpenLink,
    required this.onOpenAttachment,
  });

  final PostDetail post;
  final String? opening;
  final void Function(String url) onOpenLink;
  final void Function(Attachment attachment) onOpenAttachment;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodyMedium?.copyWith(
      color: theme.colorScheme.onSurfaceVariant,
    );
    final publishedAt = post.publishedAt;
    final meta = [
      ?post.authorName,
      if (publishedAt != null) formatDotDate(publishedAt),
    ].join(' · ');

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        if (post.pinned)
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              children: [
                Icon(
                  Icons.push_pin,
                  size: 16,
                  color: theme.colorScheme.primary,
                ),
                const SizedBox(width: 4),
                Text(
                  '고정 공지',
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: theme.colorScheme.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        // 본문은 길게 눌러 복사할 수 있다 — 계좌번호·장소를 옮겨 적는 일이 많다
        SelectionArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Semantics(
                header: true,
                child: Text(
                  post.title,
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (meta.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(meta, style: muted),
              ],
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Divider(height: 1),
              ),
              PostBodyView(body: post.body, onOpenLink: onOpenLink),
            ],
          ),
        ),
        if (post.attachments.isNotEmpty) ...[
          const SizedBox(height: 32),
          Text(
            '첨부파일',
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Card(
            margin: EdgeInsets.zero,
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                for (final (i, a) in post.attachments.indexed) ...[
                  if (i > 0) const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.insert_drive_file_outlined),
                    title: Text(a.filename),
                    subtitle: Text(formatFileSize(a.sizeBytes)),
                    trailing: opening == a.id
                        ? const SizedBox.square(
                            dimension: 24,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.download_outlined),
                    onTap: () => onOpenAttachment(a),
                  ),
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }
}
