import 'package:flutter/material.dart';

import '../../core/api/api_error.dart';
import '../../core/paging/paged_list.dart';
import '../../core/ui/paged_list_view.dart';
import '../../core/ui/status_views.dart';
import '../account/login_gate.dart';
import 'post_card.dart';
import 'notice_feed.dart';
import 'post_summary.dart';
import 'posts_api.dart';

/// 분류 하나의 게시물 목록 — 회의록 · 예산안 (기획안 §2-3 ⑤ M9).
///
/// 공지 목록과 같은 줄 모양(📌 · 제목 · 날짜 · 첨부)이고, 누르면 공지 상세와 같은
/// 화면이 열린다. 끝까지 내리면 다음 페이지 — 웹 `/documents`는 20건에서
/// 잘렸다(점검 🟠-5).
///
/// 예산안은 임원 이상만 볼 수 있다. 회원은 자료 탭에서 카드가 보이지 않지만,
/// 주소로 들어오면 서버가 목록에 **403**을 준다 — 로그인을 권하지 않고
/// "권한이 없어요"로 끝낸다 (SPEC_API §3.1, 기획안 §1).
class PostsListScreen extends StatefulWidget {
  const PostsListScreen({
    super.key,
    required this.posts,
    required this.category,
    required this.title,
    required this.emptyMessage,
    required this.onOpen,
    required this.onLogin,
  });

  final PostsApi posts;
  final PostCategory category;
  final String title;
  final String emptyMessage;
  final void Function(PostSummary post) onOpen;
  final VoidCallback onLogin;

  @override
  State<PostsListScreen> createState() => _PostsListScreenState();
}

class _PostsListScreenState extends State<PostsListScreen> {
  late final _list = PagedList<PostSummary>(
    () => NoticeFeedSource(widget.posts, [widget.category]),
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
        title: Text(
          widget.title,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      body: ListenableBuilder(
        listenable: _list,
        builder: (context, _) {
          if (_list.items.isEmpty) {
            switch (_list.error) {
              case ApiError(code: ErrorCode.unauthorized):
                return LoginGate(onLogin: widget.onLogin);
              case ApiError(code: ErrorCode.forbidden):
                return const MessageView(
                  icon: Icons.block,
                  message: '이 자료를 볼 권한이 없어요.',
                );
            }
          }
          return PagedListView<PostSummary>(
            list: _list,
            onRefresh: _list.refresh,
            emptyMessage: widget.emptyMessage,
            cards: true,
            itemBuilder: (context, post) =>
                PostCard(post, onTap: () => widget.onOpen(post)),
          );
        },
      ),
    );
  }
}
