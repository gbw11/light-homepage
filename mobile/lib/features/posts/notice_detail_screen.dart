import 'package:flutter/material.dart';

import '../../core/api/api_error.dart';
import '../../core/format/date_format.dart';
import '../../core/format/file_size.dart';
import '../../core/ui/status_views.dart';
import '../account/login_gate.dart';
import 'post_body_view.dart';
import 'post_detail.dart';
import 'post_summary.dart';
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
    this.onLogin,
    this.title = '공지',
  });

  final PostsApi posts;
  final String idOrSlug;

  /// 본문 링크와 첨부파일을 바깥 앱(브라우저 등)으로 연다
  final Future<void> Function(String url) openExternal;

  /// 회원 글을 비로그인으로 열었을 때 [로그인]. 없으면 안내 문구만 둔다
  final VoidCallback? onLogin;

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
              ApiError(code: ErrorCode.unauthorized) =>
                switch (widget.onLogin) {
                  final onLogin? => LoginGate(onLogin: onLogin),
                  null => const MessageView(
                    icon: Icons.lock_outline,
                    message: '로그인하면 볼 수 있어요.',
                  ),
                },
              // 로그인했지만 권한이 모자라다 — 로그인을 권하면 같은 곳을 맴돈다
              ApiError(code: ErrorCode.forbidden) => const MessageView(
                icon: Icons.block,
                message: '이 글을 볼 권한이 없어요.',
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

/// 글 한 편 (사용자 시안 2026-10-14):
///
/// ```
///  [공지 | 📌 고정]
///  제목 (크고 굵게)
///  (🌿) 작성자 · 2026.09.04 10:30
///  ┌ 베이지 판 ──────────┐
///  │ 본문                │
///  └─────────────────────┘
///  첨부파일 …
/// ```
///
/// 시안의 「조회 342회」는 없다 — 서버가 조회 수를 세지 않는다 (SPEC_API §3.3).
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
    final scheme = theme.colorScheme;
    final muted = theme.textTheme.bodyMedium?.copyWith(
      color: scheme.onSurfaceVariant,
      fontWeight: FontWeight.w600,
    );
    final publishedAt = post.publishedAt;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
      children: [
        Align(alignment: Alignment.centerLeft, child: _CategoryChip(post)),
        const SizedBox(height: 12),
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
                    fontWeight: FontWeight.w800,
                    height: 1.35,
                  ),
                ),
              ),
              const SizedBox(height: 14),
              // 작성자 · 날짜 — 큰 글씨에서는 날짜가 다음 줄로 내려간다
              Wrap(
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 10,
                runSpacing: 6,
                children: [
                  if (post.authorName case final author?)
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        ExcludeSemantics(
                          child: Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: scheme.primary,
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              Icons.eco_outlined,
                              size: 20,
                              color: scheme.onPrimary,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Flexible(child: Text(author, style: muted)),
                      ],
                    ),
                  if (post.authorName != null && publishedAt != null)
                    ExcludeSemantics(
                      child: Container(
                        width: 4,
                        height: 4,
                        decoration: BoxDecoration(
                          color: scheme.outlineVariant,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                  if (publishedAt != null)
                    Text(_dateTime(publishedAt), style: muted),
                ],
              ),
              const SizedBox(height: 20),
              // 본문 — 베이지 판 위에
              DecoratedBox(
                decoration: BoxDecoration(
                  color: scheme.surfaceContainer,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 22, 20, 22),
                  child: PostBodyView(body: post.body, onOpenLink: onOpenLink),
                ),
              ),
            ],
          ),
        ),
        if (post.attachments.isNotEmpty) ...[
          const SizedBox(height: 28),
          Row(
            children: [
              Icon(Icons.attach_file, size: 20, color: scheme.primary),
              const SizedBox(width: 6),
              Semantics(
                header: true,
                child: Text(
                  '첨부파일 ${post.attachments.length}',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          for (final a in post.attachments) ...[
            _AttachmentRow(
              a,
              opening: opening == a.id,
              onTap: () => onOpenAttachment(a),
            ),
            const SizedBox(height: 8),
          ],
        ],
      ],
    );
  }

  /// `2026.09.04 10:30` — 기기 시간대로
  static String _dateTime(DateTime at) {
    final local = at.toLocal();
    final hh = local.hour.toString().padLeft(2, '0');
    final mm = local.minute.toString().padLeft(2, '0');
    return '${formatDotDate(at)} $hh:$mm';
  }
}

/// 「📌 고정」 또는 분류 이름 — 목록 카드와 같은 딱지
class _CategoryChip extends StatelessWidget {
  const _CategoryChip(this.post);

  final PostDetail post;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final label = post.pinned
        ? '📌 고정'
        : switch (post.category) {
            PostCategory.noticePublic || PostCategory.noticeMember => '공지',
            PostCategory.minutes => '회의록',
            PostCategory.budget => '예산안',
          };
    return DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.primary.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        child: Text(
          label,
          style: theme.textTheme.labelLarge?.copyWith(
            color: scheme.primary,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

/// 첨부 한 줄 — 흰 판 · 파일 아이콘 · 이름 · 크기 · 받기
class _AttachmentRow extends StatelessWidget {
  const _AttachmentRow(
    this.attachment, {
    required this.opening,
    required this.onTap,
  });

  final Attachment attachment;
  final bool opening;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Material(
      // 정한 색 토큰에 흰색이 따로 없어 onPrimary(흰색)를 쓴다
      color: scheme.onPrimary,
      borderRadius: BorderRadius.circular(16),
      elevation: 0.5,
      shadowColor: scheme.onSurface.withValues(alpha: 0.2),
      clipBehavior: Clip.antiAlias,
      child: ListTile(
        onTap: onTap,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16),
        leading: Icon(Icons.insert_drive_file_outlined, color: scheme.primary),
        title: Text(
          attachment.filename,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.bodyLarge?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        subtitle: Text(formatFileSize(attachment.sizeBytes)),
        trailing: opening
            ? const SizedBox.square(
                dimension: 24,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Icon(Icons.download_outlined),
      ),
    );
  }
}
