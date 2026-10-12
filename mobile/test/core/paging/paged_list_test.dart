import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/core/paging/paged_list.dart';

/// 정해 둔 묶음을 차례로 주는 가짜. [fail]이 true면 다음 한 번을 실패한다
class FakeSource implements PageSource<int> {
  FakeSource(this.pages);

  final List<List<int>> pages;
  var calls = 0;
  var fail = false;
  var _at = 0;

  @override
  Future<PageChunk<int>> next() async {
    calls++;
    if (fail) {
      fail = false;
      throw StateError('boom');
    }
    final items = pages[_at++];
    return (items: items, hasMore: _at < pages.length);
  }
}

void main() {
  test('끝까지 이어서 받고, 끝나면 더 부르지 않는다', () async {
    final source = FakeSource([
      [1, 2],
      [3],
    ]);
    final list = PagedList(() => source);

    await list.loadMore();
    expect(list.items, [1, 2]);
    expect(list.hasMore, isTrue);

    await list.loadMore();
    expect(list.items, [1, 2, 3]);
    expect(list.hasMore, isFalse);

    await list.loadMore();
    expect(source.calls, 2);
  });

  test('받는 중에 또 부르면 한 번만 요청한다', () async {
    final source = FakeSource([
      [1],
      [2],
    ]);
    final list = PagedList(() => source);

    await Future.wait([list.loadMore(), list.loadMore()]);

    expect(source.calls, 1);
    expect(list.items, [1]);
  });

  test('실패하면 목록을 남기고 오류만 채운다 — 다시 시도는 같은 묶음을 받는다', () async {
    final source = FakeSource([
      [1],
      [2],
    ]);
    final list = PagedList(() => source);
    await list.loadMore();

    source.fail = true;
    await list.loadMore();
    expect(list.items, [1]);
    expect(list.error, isA<StateError>());

    await list.loadMore();
    expect(list.items, [1, 2]);
    expect(list.error, isNull);
  });

  test('새로고침은 새 출처로 처음부터 받는다', () async {
    var made = 0;
    final list = PagedList(() {
      made++;
      return FakeSource([
        [made * 10],
        [made * 10 + 1],
      ]);
    });
    await list.loadMore();
    await list.loadMore();
    expect(list.items, [10, 11]);

    await list.refresh();

    expect(list.items, [20]);
    expect(list.hasMore, isTrue);
  });

  test('새로고침이 실패하면 지금 목록을 지킨다', () async {
    var made = 0;
    final list = PagedList(() {
      made++;
      return FakeSource([
        [1],
      ])..fail = made > 1;
    });
    await list.loadMore();

    await list.refresh();

    expect(list.items, [1]);
    expect(list.error, isA<StateError>());
  });

  test('새로고침보다 먼저 출발한 응답은 늦게 와도 버린다', () async {
    final slow = Completer<PageChunk<int>>();
    var made = 0;
    final list = PagedList<int>(() {
      made++;
      return made == 1
          ? _Manual(slow.future)
          : FakeSource([
              [99],
            ]);
    });

    final stale = list.loadMore();
    await list.refresh();
    slow.complete((items: [1], hasMore: false));
    await stale;

    expect(list.items, [99]);
  });

  test('reset은 지금 목록을 바로 비우고 처음부터 받는다', () async {
    var made = 0;
    final list = PagedList(() {
      made++;
      return FakeSource([
        [made],
      ]);
    });
    await list.loadMore();
    expect(list.items, [1]);

    list.reset();
    // 받는 동안에도 옛 목록이 보이면 안 된다 (로그아웃 뒤 회원 공지)
    expect(list.items, isEmpty);
    expect(list.isLoading, isTrue);

    await pumpEventQueue();
    expect(list.items, [2]);
  });
}

class _Manual implements PageSource<int> {
  _Manual(this.result);

  final Future<PageChunk<int>> result;

  @override
  Future<PageChunk<int>> next() => result;
}
