import 'package:flutter/material.dart';

import '../paging/paged_list.dart';
import 'status_views.dart';

/// [PagedList]를 그리는 목록 — 당겨서 새로고침 · 끝까지 내리면 다음 묶음.
///
/// 목록이 비어 있을 때는 로딩 · 오류 · 빈 상태를 남은 자리 가운데에 그린다.
/// 그 상태에서도 당겨서 새로고침이 되도록 스크롤 가능한 틀 안에 둔다.
class PagedListView<T> extends StatelessWidget {
  const PagedListView({
    super.key,
    required this.list,
    required this.itemBuilder,
    required this.onRefresh,
    required this.emptyMessage,
    this.header = const [],
    this.end,
    this.cards = false,
    this.where,
    this.noMatchMessage,
    this.sectionHeader,
  });

  final PagedList<T> list;
  final Widget Function(BuildContext context, T item) itemBuilder;

  /// 당겼을 때. 목록 위의 칸(라이브 카드 등)도 함께 다시 받는 화면이 있어서
  /// [PagedList.refresh]를 직접 부르지 않고 화면에 맡긴다
  final Future<void> Function() onRefresh;
  final String emptyMessage;

  /// 목록 위에 붙는 칸들. 목록과 함께 스크롤된다
  final List<Widget> header;

  /// 끝까지 받았을 때 맨 아래에 붙는 칸
  final Widget? end;

  /// 칸이 카드면 구분선 대신 사이를 띄우고 양옆 여백을 둔다
  final bool cards;

  /// 받은 것 중 보일 것만 (검색 등). 걸러서 하나도 안 남아도 아직 받을 것이
  /// 있으면 꼬리가 다음 묶음을 계속 받는다 — 다 받고도 없으면 [noMatchMessage]
  final bool Function(T item)? where;
  final String? noMatchMessage;

  /// 칸 위에 붙는 소제목 (「고정 공지」 등). [previous]는 바로 앞에 보이는 칸
  final Widget? Function(T item, T? previous)? sectionHeader;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListenableBuilder(
        listenable: list,
        builder: (context, _) {
          final where = this.where;
          final visible = where == null
              ? list.items
              : list.items.where(where).toList();
          final noMatch =
              visible.isEmpty && !list.hasMore && list.error == null;
          return CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              for (final widget in header) SliverToBoxAdapter(child: widget),
              if (list.items.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: switch (list) {
                    PagedList(error: final error?) => ErrorView(
                      error: error,
                      onRetry: list.loadMore,
                    ),
                    PagedList(hasMore: true) => const LoadingView(),
                    _ => Column(
                      children: [
                        MessageView(message: emptyMessage),
                        ?end,
                      ],
                    ),
                  },
                )
              else
                SliverList.separated(
                  // 마지막 한 칸은 꼬리(더 받기 · 오류 · 끝)다
                  itemCount: visible.length + 1,
                  separatorBuilder: (_, _) => cards
                      ? const SizedBox(height: 12)
                      : const Divider(height: 1, indent: 16, endIndent: 16),
                  itemBuilder: (context, i) {
                    if (i == visible.length) {
                      return noMatch
                          ? MessageView(message: noMatchMessage ?? emptyMessage)
                          : _Tail(list: list, end: end);
                    }
                    final item = visible[i];
                    final heading = sectionHeader?.call(
                      item,
                      i == 0 ? null : visible[i - 1],
                    );
                    final tile = itemBuilder(context, item);
                    final body = heading == null
                        ? tile
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [heading, tile],
                          );
                    return cards
                        ? Padding(
                            padding: EdgeInsets.fromLTRB(
                              16,
                              i == 0 ? 12 : 0,
                              16,
                              0,
                            ),
                            child: body,
                          )
                        : body;
                  },
                ),
            ],
          );
        },
      ),
    );
  }
}

/// 목록 꼬리.
///
/// [SliverList]는 화면 가까이 온 칸만 만든다. 그래서 이 칸이 **만들어졌다는 것
/// 자체가 끝까지 내려왔다는 뜻**이다 — 스크롤 위치를 따로 재지 않고 여기서
/// 다음 묶음을 부른다. 첫 묶음이 화면을 다 채우지 못해도 그대로 이어진다.
class _Tail extends StatelessWidget {
  const _Tail({required this.list, required this.end});

  final PagedList<Object?> list;
  final Widget? end;

  @override
  Widget build(BuildContext context) {
    if (list.error case final error?) {
      return ErrorView(error: error, onRetry: list.loadMore);
    }
    if (list.hasMore) {
      if (!list.isLoading) {
        // 그리는 도중에 상태를 바꾸면 안 된다 — 이번 프레임이 끝난 뒤에 부른다
        WidgetsBinding.instance.addPostFrameCallback((_) => list.loadMore());
      }
      return const LoadingView(height: 96);
    }
    return end ?? const SizedBox(height: 32);
  }
}
