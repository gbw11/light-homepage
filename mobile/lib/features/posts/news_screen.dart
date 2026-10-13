import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../core/format/date_format.dart';
import '../../core/paging/paged_list.dart';
import '../../core/ui/form_card.dart';
import '../../core/ui/menu_button.dart';
import '../../core/ui/profile_button.dart';
import '../../core/ui/paged_list_view.dart';
import 'notice_feed.dart';
import 'post_summary.dart';
import 'posts_api.dart';

/// 공지 탭 — 공지 목록 (웹 `/news`, 기획안 §2-2 ①, 사용자 시안 2026-10-13).
///
/// ```
///  [🔍 공지사항과 소식을 검색해 보세요]
///  📌 고정 공지 (2건)                    꼭 확인해 주세요
///  ┌ 흰 카드 ─ [공지] [📎 1]          2026.09.04 ┐
///  │ 제목 (두 줄까지)                          │
///  │ 👤 작성자                       상세보기 → │
///  ▌전체 공지 …
/// ```
///
/// 공개 공지와 회원 공지를 **한 목록으로** 보여준다. 회원 전용 딱지는 달지
/// 않는다 (DECISIONS 09-16) — 로그인한 사람에게는 둘 다 "우리 공지"다.
///
/// 시안의 주제 칩(수련회/행사 · 예배/모임 …) · 마감(D-3) · 장소 · 본문 미리보기는
/// 없다 — 공지에 그런 값이 없다 (SPEC_API §3.2). 검색도 서버에 없어 **받은 공지의
/// 제목**에서 찾는다. 찾는 동안에는 남은 공지를 이어서 받는다.
class NewsScreen extends StatefulWidget {
  const NewsScreen({
    super.key,
    required this.posts,
    required this.categories,
    required this.onOpen,
    this.onLogin,
  });

  final PostsApi posts;

  /// 보여줄 분류. 비로그인은 공개 공지만, 로그인하면 회원 공지까지다.
  /// 회원 공지를 비로그인으로 부르면 서버가 401을 준다 — 목록 전체를 오류로
  /// 만들 이유가 없으니 처음부터 부르지 않는다
  final List<PostCategory> categories;
  final void Function(PostSummary notice) onOpen;

  /// 비로그인 안내 줄을 누르면
  final VoidCallback? onLogin;

  @override
  State<NewsScreen> createState() => _NewsScreenState();
}

class _NewsScreenState extends State<NewsScreen> {
  late final _list = PagedList<PostSummary>(
    () => NoticeFeedSource(widget.posts, widget.categories),
  );
  final _search = TextEditingController();
  var _query = '';

  @override
  void initState() {
    super.initState();
    _list.loadMore();
  }

  @override
  void didUpdateWidget(NewsScreen old) {
    super.didUpdateWidget(old);
    // 로그인·로그아웃으로 볼 수 있는 분류가 바뀌었다. 옛 목록을 잠깐이라도
    // 남기면 로그아웃한 화면에 회원 공지 제목이 보인다
    if (!listEquals(old.categories, widget.categories)) _list.reset();
  }

  @override
  void dispose() {
    _list.dispose();
    _search.dispose();
    super.dispose();
  }

  bool get _seesMemberNotices =>
      widget.categories.contains(PostCategory.noticeMember);

  bool _matches(PostSummary notice) =>
      notice.title.toLowerCase().contains(_query.toLowerCase());

  /// 고정 공지가 시작하는 자리, 고정이 끝나고 나머지가 시작하는 자리에 소제목
  Widget? _sectionHeader(PostSummary item, PostSummary? previous) {
    if (item.pinned && previous == null) {
      final pinned = _list.items
          .where((p) => p.pinned && (_query.isEmpty || _matches(p)))
          .length;
      return _PinnedHeader(count: pinned);
    }
    if (!item.pinned && previous != null && previous.pinned) {
      return const _SectionLabel('전체 공지');
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const MenuButton(),
        actions: const [ProfileButton()],
        title: const Text('공지', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: PagedListView<PostSummary>(
        list: _list,
        onRefresh: _list.refresh,
        emptyMessage: '등록된 공지가 없어요.',
        noMatchMessage: '「$_query」가 들어간 공지가 없어요.',
        cards: true,
        // 머리글은 두지 않는다 — 제목줄의 「공지」와 검색 칸이면 된다 (사용자 결정 2026-10-13)
        header: [
          _SearchField(
            controller: _search,
            onChanged: (v) => setState(() => _query = v.trim()),
          ),
        ],
        where: _query.isEmpty ? null : _matches,
        sectionHeader: _sectionHeader,
        itemBuilder: (context, notice) =>
            _NoticeCard(notice, onTap: () => widget.onOpen(notice)),
        end: _seesMemberNotices ? null : _MemberHint(onLogin: widget.onLogin),
      ),
    );
  }
}

/// 제목 검색 칸 — 베이지로 채운 둥근 칸
class _SearchField extends StatelessWidget {
  const _SearchField({required this.controller, required this.onChanged});

  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
      child: ListenableBuilder(
        listenable: controller,
        builder: (context, _) => TextField(
          controller: controller,
          onChanged: onChanged,
          textInputAction: TextInputAction.search,
          decoration: cardInputDecoration(
            context,
            icon: Icons.search,
            hint: '공지사항과 소식을 검색해 보세요',
            suffix: controller.text.isEmpty
                ? null
                : IconButton(
                    tooltip: '검색어 지우기',
                    icon: Icon(Icons.close, color: scheme.onSurfaceVariant),
                    onPressed: () {
                      controller.clear();
                      onChanged('');
                    },
                  ),
          ),
        ),
      ),
    );
  }
}

/// 「📌 고정 공지 (2건) ··· 꼭 확인해 주세요」
class _PinnedHeader extends StatelessWidget {
  const _PinnedHeader({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 8, 4, 12),
      child: Row(
        children: [
          Icon(Icons.push_pin, size: 20, color: scheme.primary),
          const SizedBox(width: 6),
          Flexible(
            child: Semantics(
              header: true,
              child: Text(
                '고정 공지',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          DecoratedBox(
            decoration: BoxDecoration(
              color: scheme.primary.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              child: Text(
                '$count건',
                style: theme.textTheme.labelMedium?.copyWith(
                  color: scheme.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          // 큰 글씨에서 한 줄에 다 못 들어가면 이 안내가 줄어든다 — 제목 · 건수가 먼저다
          Expanded(
            child: Text(
              '꼭 확인해 주세요',
              textAlign: TextAlign.end,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.labelMedium?.copyWith(
                color: scheme.onSurfaceVariant,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 「▌전체 공지」 — 고정 공지 다음
class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.title);

  final String title;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 16, 4, 12),
      child: Semantics(
        header: true,
        child: Row(
          children: [
            Container(
              width: 5,
              height: 18,
              decoration: BoxDecoration(
                color: theme.colorScheme.primary,
                borderRadius: BorderRadius.circular(3),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              title,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 공지 한 장 — [딱지] [📎 n] ··· 날짜 / 제목 / 👤 작성자 ··· 상세보기 →
class _NoticeCard extends StatelessWidget {
  const _NoticeCard(this.notice, {required this.onTap});

  final PostSummary notice;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final muted = theme.textTheme.bodyMedium?.copyWith(
      color: scheme.onSurfaceVariant,
    );
    final publishedAt = notice.publishedAt;
    Widget pill(String text, {required Color bg, required Color fg}) =>
        DecoratedBox(
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            child: Text(
              text,
              style: theme.textTheme.labelMedium?.copyWith(
                color: fg,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        );
    return Material(
      // 정한 색 토큰에 흰색이 따로 없어 onPrimary(흰색)를 쓴다
      color: scheme.onPrimary,
      borderRadius: BorderRadius.circular(20),
      elevation: 0.5,
      shadowColor: scheme.onSurface.withValues(alpha: 0.2),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 14),
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
                        if (notice.pinned)
                          pill(
                            '📌 고정',
                            bg: scheme.primary.withValues(alpha: 0.14),
                            fg: scheme.primary,
                          )
                        else
                          pill(
                            '공지',
                            bg: scheme.outlineVariant.withValues(alpha: 0.6),
                            fg: scheme.onSurfaceVariant,
                          ),
                        if (notice.attachmentCount > 0)
                          Semantics(
                            label: '첨부 ${notice.attachmentCount}개',
                            excludeSemantics: true,
                            child: pill(
                              '📎 ${notice.attachmentCount}',
                              bg: scheme.surfaceContainer,
                              fg: scheme.onSurfaceVariant,
                            ),
                          ),
                      ],
                    ),
                  ),
                  if (publishedAt != null)
                    Text(formatDotDate(publishedAt), style: muted),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                notice.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  if (notice.authorName case final author?) ...[
                    Icon(
                      Icons.person_outline,
                      size: 18,
                      color: scheme.onSurfaceVariant,
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        author,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: muted,
                      ),
                    ),
                  ] else
                    const Spacer(),
                  ExcludeSemantics(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '상세보기',
                          style: theme.textTheme.labelLarge?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Icon(Icons.arrow_forward, size: 18),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 비로그인일 때 목록 끝 — 회원 공지가 따로 있다는 것만 알린다
class _MemberHint extends StatelessWidget {
  const _MemberHint({required this.onLogin});

  final VoidCallback? onLogin;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = theme.colorScheme.onSurfaceVariant;
    final row = Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 20),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.lock_outline, size: 18, color: color),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              '로그인하면 회원 공지도 볼 수 있어요.',
              style: theme.textTheme.bodyMedium?.copyWith(color: color),
            ),
          ),
          if (onLogin != null)
            Icon(Icons.chevron_right, size: 20, color: color),
        ],
      ),
    );
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: switch (onLogin) {
        final onLogin? => InkWell(onTap: onLogin, child: row),
        null => row,
      },
    );
  }
}
