import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/features/posts/notice_feed.dart';
import 'package:light_mobile/features/posts/post_summary.dart';
import 'package:light_mobile/features/posts/posts_api.dart';

import '../../support/fake_server.dart';

Map<String, dynamic> post(
  String id,
  String category,
  String day, {
  bool pinned = false,
}) => {
  'id': id,
  'category': category,
  'title': '글 $id',
  'slug': null,
  'pinned': pinned,
  'authorName': '김도연a',
  'publishedAt': '2026-10-${day}T03:00:00Z',
  'attachmentCount': 0,
};

/// 분류마다 서버 순서(고정 → 최신)로 정렬된 글 목록을 [size]씩 잘라 준다
FakeServer serverWith(Map<String, List<Map<String, dynamic>>> byCategory) =>
    FakeServer((RequestOptions o) async {
      final all = byCategory[o.queryParameters['category']]!;
      final page = o.queryParameters['page'] as int;
      final size = o.queryParameters['size'] as int;
      final items = all.skip(page * size).take(size).toList();
      return respond(200, {
        'data': {
          'items': items,
          'page': page,
          'size': size,
          'hasNext': (page + 1) * size < all.length,
        },
      });
    });

const public = 'NOTICE_PUBLIC';
const member = 'NOTICE_MEMBER';

List<String> ids(List<PostSummary> posts) => [for (final p in posts) p.id];

void main() {
  test('두 분류를 합쳐도 고정 글이 먼저 오고, 그다음 최신순이다', () async {
    final server = serverWith({
      public: [
        post('3', public, '03', pinned: true),
        post('9', public, '09'),
        post('1', public, '01'),
      ],
      member: [
        post('5', member, '05', pinned: true),
        post('8', member, '08'),
        post('2', member, '02'),
      ],
    });
    final feed = NoticeFeedSource(PostsApi(clientFor(server)), [
      PostCategory.noticePublic,
      PostCategory.noticeMember,
    ]);

    final chunk = await feed.next();

    // 날짜로만 정렬하면 고정 글(5·3)이 9·8 아래로 내려간다 — 웹이 그랬다
    expect(ids(chunk.items), ['5', '3', '9', '8', '2', '1']);
    expect(chunk.hasMore, isFalse);
  });

  test('분류마다 따로 페이지를 넘겨 끝까지 받는다 — 순서도 그대로다', () async {
    final publicPosts = [
      for (var d = 28; d >= 1; d -= 2)
        post('$d', public, d.toString().padLeft(2, '0')),
    ];
    final memberPosts = [
      for (var d = 27; d >= 1; d -= 2)
        post('$d', member, d.toString().padLeft(2, '0')),
    ];
    final server = serverWith({public: publicPosts, member: memberPosts});
    final feed = NoticeFeedSource(PostsApi(clientFor(server)), [
      PostCategory.noticePublic,
      PostCategory.noticeMember,
    ], pageSize: 5);

    final all = <PostSummary>[];
    while (true) {
      final chunk = await feed.next();
      all.addAll(chunk.items);
      if (!chunk.hasMore) break;
    }

    expect(ids(all), [for (var d = 28; d >= 1; d--) '$d']);
  });

  test('분류 하나만이면 보통 목록처럼 넘긴다', () async {
    final server = serverWith({
      public: [for (var d = 9; d >= 1; d--) post('$d', public, '0$d')],
    });
    final feed = NoticeFeedSource(PostsApi(clientFor(server)), [
      PostCategory.noticePublic,
    ], pageSize: 4);

    expect(ids((await feed.next()).items), ['9', '8', '7', '6']);
    expect(ids((await feed.next()).items), ['5', '4', '3', '2']);
    final last = await feed.next();
    expect(ids(last.items), ['1']);
    expect(last.hasMore, isFalse);
  });

  test('도중에 실패하면 꺼낸 글까지만 주고, 다음 번에 이어서 받는다', () async {
    var failPublicPage1 = true;
    final inner = serverWith({
      public: [for (var d = 9; d >= 1; d -= 2) post('$d', public, '0$d')],
      member: [for (var d = 8; d >= 2; d -= 2) post('$d', member, '0$d')],
    });
    final server = FakeServer((o) async {
      if (o.queryParameters['category'] == public &&
          o.queryParameters['page'] == 1 &&
          failPublicPage1) {
        failPublicPage1 = false;
        return respond(500, {
          'error': {'code': 'INTERNAL_ERROR', 'message': 'x', 'field': null},
        });
      }
      return inner.handler(o);
    });
    final feed = NoticeFeedSource(PostsApi(clientFor(server)), [
      PostCategory.noticePublic,
      PostCategory.noticeMember,
    ], pageSize: 3);

    expect(ids((await feed.next()).items), ['9', '8', '7']);
    // 6·5를 꺼낸 뒤 공개 2쪽이 실패한다 — 꺼낸 글은 버리지 않는다
    final partial = await feed.next();
    expect(ids(partial.items), ['6', '5']);
    expect(partial.hasMore, isTrue);

    final rest = <String>[];
    while (true) {
      final chunk = await feed.next();
      rest.addAll(ids(chunk.items));
      if (!chunk.hasMore) break;
    }
    expect(rest, ['4', '3', '2', '1']);
  });

  test('처음부터 실패하면 실패를 알린다', () async {
    final server = FakeServer(
      (_) async => respond(500, {
        'error': {'code': 'INTERNAL_ERROR', 'message': 'x', 'field': null},
      }),
    );
    final feed = NoticeFeedSource(PostsApi(clientFor(server)), [
      PostCategory.noticePublic,
    ]);

    expect(feed.next(), throwsA(anything));
  });
}
