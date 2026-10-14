import 'package:flutter/material.dart';

import '../../core/format/date_format.dart';
import 'post_summary.dart';

/// 글 카드 — 소식 · 회의록 · 예산안 목록과 홈이 함께 쓴다.
///
/// ```
/// ╭──────────────────────────────╮
/// │ [공지 | 📌 고정]    📎 1  📅 10.4 │
/// │ 제목 (두 줄까지)                 │
/// ╰──────────────────────────────╯
/// ```
///
/// 딱지는 고정 글이면 「📌 고정」(초록), 아니면 분류 이름이다. 공개 · 회원 공지는
/// 둘 다 「공지」다 — 회원 전용 딱지는 달지 않는다. 로그인한 사람에게는 둘 다
/// "우리 공지"다 (DECISIONS 09-16).
class PostCard extends StatelessWidget {
  const PostCard(this.post, {super.key, required this.onTap});

  final PostSummary post;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final muted = theme.textTheme.bodyMedium?.copyWith(
      color: scheme.onSurfaceVariant,
    );
    final publishedAt = post.publishedAt;

    Widget meta(IconData icon, String text) => Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: scheme.onSurfaceVariant),
        const SizedBox(width: 4),
        Text(text, style: muted),
      ],
    );

    return Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _Chip(post),
                  const SizedBox(width: 8),
                  // 큰 글씨에서는 첨부 · 날짜가 다음 줄로 내려간다 — 한 줄에 묶으면 넘친다
                  Expanded(
                    child: Wrap(
                      alignment: WrapAlignment.end,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 12,
                      runSpacing: 4,
                      children: [
                        if (post.attachmentCount > 0)
                          Semantics(
                            label: '첨부 ${post.attachmentCount}개',
                            excludeSemantics: true,
                            child: meta(
                              Icons.attach_file,
                              '${post.attachmentCount}',
                            ),
                          ),
                        if (publishedAt != null)
                          meta(
                            Icons.calendar_today_outlined,
                            formatShortDate(publishedAt),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                post.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip(this.post);

  final PostSummary post;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final pinned = post.pinned;
    // 고정도 같은 갈색 딱지에 핀만 단다 — 옅은 민트(primaryContainer)는 크림 바탕과
    // 겉돌았다 (사용자 결정 2026-10-14)
    final fg = scheme.onSurfaceVariant;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.outlineVariant.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (pinned) ...[
              Icon(Icons.push_pin_outlined, size: 14, color: fg),
              const SizedBox(width: 4),
            ],
            Text(
              pinned ? '고정' : _categoryLabel(post.category),
              style: Theme.of(context).textTheme.labelLarge
                  ?.copyWith(color: fg, fontWeight: FontWeight.w700),
            ),
          ],
        ),
      ),
    );
  }
}

String _categoryLabel(PostCategory category) => switch (category) {
  PostCategory.noticePublic || PostCategory.noticeMember => '공지',
  PostCategory.minutes => '회의록',
  PostCategory.budget => '예산안',
};
