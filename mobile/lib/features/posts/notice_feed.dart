import 'dart:collection';

import '../../core/paging/paged_list.dart';
import 'post_summary.dart';
import 'posts_api.dart';

/// 서버 정렬과 같은 순서 — 고정 먼저, 그다음 최신순 (SPEC_API §3.2).
/// 날짜가 같으면 id 큰 쪽(나중에 쓴 글)이 앞이다. 날짜 없는 글은 맨 뒤
int compareNotices(PostSummary a, PostSummary b) {
  if (a.pinned != b.pinned) return a.pinned ? -1 : 1;
  final byDate = switch ((a.publishedAt, b.publishedAt)) {
    (final x?, final y?) => y.compareTo(x),
    (null, null) => 0,
    (null, _) => 1,
    (_, null) => -1,
  };
  if (byDate != 0) return byDate;
  return (int.tryParse(b.id) ?? 0).compareTo(int.tryParse(a.id) ?? 0);
}

/// 여러 분류의 공지를 **한 목록으로** 이어 받는다 (공개 + 회원 공지, 기획안 §2-2).
///
/// 웹에서 생긴 결함 둘을 피한다.
///   · 두 분류를 이어 붙이고 날짜로만 다시 정렬해서 **고정 글이 위로 오지 않았다**
///     (10-07 수정) → [compareNotices]로 고정을 먼저 본다
///   · 분류마다 첫 20건만 받아서 **그 뒤 공지가 사라졌다** (점검 🟠-5)
///     → 분류마다 따로 페이지를 넘긴다
///
/// 각 분류의 응답은 서버가 이미 [compareNotices] 순서로 준다. 그래서 분류마다
/// 맨 앞 하나씩만 비교해 가장 앞선 것을 꺼내면(병합) 전체 순서가 맞다. 어느
/// 분류의 받아 둔 글이 바닥나면, 그 분류의 다음 페이지를 받은 뒤에야 다음 글을
/// 꺼낸다 — 안 받고 꺼내면 아직 안 받은 그 분류의 글이 순서를 건너뛴다.
class NoticeFeedSource implements PageSource<PostSummary> {
  NoticeFeedSource(
    PostsApi posts,
    List<PostCategory> categories, {
    this.pageSize = 20,
  }) : _lanes = [for (final c in categories) _Lane(posts, c, pageSize)];

  /// 한 번에 내보내는 글 수이자, 분류마다 한 번에 받는 수
  final int pageSize;
  final List<_Lane> _lanes;

  @override
  Future<PageChunk<PostSummary>> next() async {
    final out = <PostSummary>[];
    while (out.length < pageSize) {
      try {
        await Future.wait([
          for (final lane in _lanes)
            if (lane.buffer.isEmpty && lane.hasMore) lane.fetch(),
        ]);
      } catch (_) {
        // 꺼낸 글이 없으면 실패를 알린다. 있으면 그것까지만 내보내고, 실패한
        // 분류는 다음 번에 다시 받는다 — 꺼낸 글을 버리면 목록에서 사라진다
        if (out.isEmpty) rethrow;
        break;
      }
      final ready = [
        for (final lane in _lanes)
          if (lane.buffer.isNotEmpty) lane,
      ];
      if (ready.isEmpty) break;
      final first = ready.reduce(
        (a, b) => compareNotices(a.buffer.first, b.buffer.first) <= 0 ? a : b,
      );
      out.add(first.buffer.removeFirst());
    }
    return (
      items: out,
      hasMore: _lanes.any((l) => l.buffer.isNotEmpty || l.hasMore),
    );
  }
}

/// 분류 하나의 받아 둔 글과 다음 페이지
class _Lane {
  _Lane(this._posts, this.category, this._size);

  final PostsApi _posts;
  final PostCategory category;
  final int _size;

  final buffer = Queue<PostSummary>();
  var hasMore = true;
  var _page = 0;

  Future<void> fetch() async {
    final result = await _posts.list(
      category: category,
      page: _page,
      size: _size,
    );
    _page++;
    buffer.addAll(result.items);
    hasMore = result.hasNext;
  }
}
