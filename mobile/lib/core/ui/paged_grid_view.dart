import 'package:flutter/material.dart';

import '../paging/paged_list.dart';
import 'status_views.dart';

/// [PagedList]를 격자로 그린다 — 사진첩 앨범 안 (3열).
///
/// [PagedListView](목록)와 같은 규칙이다: 당겨서 새로고침, 끝까지 내리면 다음 묶음,
/// 비어 있을 때는 로딩 · 오류 · 빈 상태를 가운데에. 다음 묶음은 **격자의 마지막
/// 칸이 만들어질 때** 부른다 — [SliverGrid]도 화면 가까이 온 칸만 만들기 때문이다.
class PagedGridView<T> extends StatelessWidget {
  const PagedGridView({
    super.key,
    required this.list,
    required this.itemBuilder,
    required this.onRefresh,
    required this.emptyMessage,
    this.crossAxisCount = 3,
    this.spacing = 2,
  });

  final PagedList<T> list;
  final Widget Function(BuildContext context, T item, int index) itemBuilder;
  final Future<void> Function() onRefresh;
  final String emptyMessage;
  final int crossAxisCount;
  final double spacing;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListenableBuilder(
        listenable: list,
        builder: (context, _) {
          final items = list.items;
          return CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              if (items.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: switch (list) {
                    PagedList(error: final error?) => ErrorView(
                      error: error,
                      onRetry: list.loadMore,
                    ),
                    PagedList(hasMore: true) => const LoadingView(),
                    _ => MessageView(message: emptyMessage),
                  },
                )
              else ...[
                SliverGrid.builder(
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: crossAxisCount,
                    mainAxisSpacing: spacing,
                    crossAxisSpacing: spacing,
                  ),
                  // 더 받을 것이 있으면 한 칸을 더 둔다 — 그 칸이 다음 묶음을 부른다
                  itemCount:
                      items.length +
                      (list.hasMore && list.error == null ? 1 : 0),
                  itemBuilder: (context, i) {
                    if (i < items.length) {
                      return itemBuilder(context, items[i], i);
                    }
                    if (!list.isLoading) {
                      WidgetsBinding.instance.addPostFrameCallback(
                        (_) => list.loadMore(),
                      );
                    }
                    return const Center(
                      child: SizedBox.square(
                        dimension: 24,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    );
                  },
                ),
                if (list.error case final error?)
                  SliverToBoxAdapter(
                    child: ErrorView(error: error, onRetry: list.loadMore),
                  ),
                const SliverToBoxAdapter(child: SizedBox(height: 32)),
              ],
            ],
          );
        },
      ),
    );
  }
}
