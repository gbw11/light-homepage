import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../core/paging/paged_list.dart';
import '../../core/ui/menu_button.dart';
import '../../core/ui/paged_list_view.dart';
import 'notice_feed.dart';
import 'post_card.dart';
import 'post_summary.dart';
import 'posts_api.dart';

/// 소식 탭 — 공지 목록 (웹 `/news`, 기획안 §2-2 ①).
///
/// 공개 공지와 회원 공지를 **한 목록으로** 보여준다. 회원 전용 딱지는 달지
/// 않는다 (DECISIONS 09-16) — 로그인한 사람에게는 둘 다 "우리 공지"다.
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
    super.dispose();
  }

  bool get _seesMemberNotices =>
      widget.categories.contains(PostCategory.noticeMember);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const MenuButton(),
        title: const Text('소식', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: PagedListView<PostSummary>(
        list: _list,
        onRefresh: _list.refresh,
        emptyMessage: '등록된 공지가 없어요.',
        cards: true,
        itemBuilder: (context, notice) =>
            PostCard(notice, onTap: () => widget.onOpen(notice)),
        end: _seesMemberNotices ? null : _MemberHint(onLogin: widget.onLogin),
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
