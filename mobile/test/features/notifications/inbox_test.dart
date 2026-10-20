import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/core/auth/auth_state.dart';
import 'package:light_mobile/features/bulletins/bulletins_api.dart';
import 'package:light_mobile/features/notifications/admin_notifications_api.dart';
import 'package:light_mobile/features/notifications/inbox.dart';
import 'package:light_mobile/features/notifications/notification_bell.dart';
import 'package:light_mobile/features/notifications/notifications_screen.dart';
import 'package:light_mobile/features/posts/posts_api.dart';

import '../../support/fake_server.dart';

class MemorySeenStore implements SeenStore {
  SeenState? saved;

  @override
  Future<SeenState?> load() async => saved;

  @override
  Future<void> save(SeenState seen) async => saved = seen;
}

final now = DateTime.utc(2026, 10, 19, 12);

Map<String, dynamic> post(String id, String category, DateTime at) => {
  'id': id,
  'category': category,
  'title': '글 $id',
  'slug': null,
  'pinned': false,
  'authorName': '전도사',
  'publishedAt': at.toIso8601String(),
  'attachmentCount': 0,
};

Map<String, dynamic> page(List<Object> items) => {
  'data': {'items': items, 'page': 0, 'size': 20, 'hasNext': false},
};

/// 서버에 있는 것 — 테스트마다 바꿔 끼운다
class Backend {
  String role = 'GUEST';
  var publicPosts = <Map<String, dynamic>>[];
  var memberPosts = <Map<String, dynamic>>[];
  var bulletins = <Map<String, dynamic>>[];
  Map<String, dynamic> newcomers = {
    'unreadCount': 0,
    'items': <Object>[],
    'hasMore': false,
    'readMarker': null,
  };
  var failBulletins = false;

  late final server = FakeServer((RequestOptions o) async {
    return switch ((o.method, o.path)) {
      ('GET', '/auth/me') when role == 'GUEST' => unauthorized(),
      ('GET', '/auth/me') || ('POST', '/auth/login') => respond(200, {
        'data': {'id': '7', 'name': '김도연a', 'role': role},
      }),
      ('GET', '/posts') => respond(
        200,
        page(switch (o.queryParameters['category']) {
          'NOTICE_MEMBER' => memberPosts,
          _ => publicPosts,
        }),
      ),
      ('GET', '/bulletins') when failBulletins => respond(500, {
        'error': {'code': 'INTERNAL_ERROR', 'message': '오류', 'field': null},
      }),
      ('GET', '/bulletins') => respond(200, page(bulletins)),
      ('GET', '/admin/notifications') => respond(200, {'data': newcomers}),
      ('POST', '/admin/notifications/read') => respond(200, {
        'data': {'readUntil': o.data['until'], 'unreadCount': 0},
      }),
      _ => respond(404),
    };
  });

  List<String> get paths => server.paths;
}

void main() {
  late Backend backend;
  late AuthState auth;
  late MemorySeenStore store;
  late NotificationInbox inbox;

  void setUpInbox() {
    final client = clientFor(backend.server);
    auth = AuthState(client);
    store = MemorySeenStore();
    inbox = NotificationInbox(
      posts: PostsApi(client),
      bulletins: BulletinsApi(client),
      admin: AdminNotificationsApi(client),
      auth: auth,
      store: store,
      clock: () => now,
    );
    final (thisInbox, thisAuth) = (inbox, auth);
    addTearDown(() {
      thisInbox.dispose();
      thisAuth.dispose();
    });
  }

  setUp(() => backend = Backend());

  Future<void> loginAs(String role) async {
    backend.role = role;
    await auth.login(loginId: 'doyeon01', password: 'pw');
    await pumpEventQueue();
  }

  test('처음 켜면 일주일 안의 것만 새 알림이다 — 한 달이 지난 것은 아예 안 보인다', () async {
    backend
      ..publicPosts = [
        post('1', 'NOTICE_PUBLIC', now.subtract(const Duration(days: 1))),
        post('2', 'NOTICE_PUBLIC', now.subtract(const Duration(days: 10))),
        post('3', 'NOTICE_PUBLIC', now.subtract(const Duration(days: 40))),
      ]
      ..bulletins = [
        {'id': '5', 'serviceDate': '2026-10-19', 'pageCount': 2},
      ];
    setUpInbox();

    await inbox.refresh();

    expect(
      [for (final i in inbox.items) i.key],
      ['bulletin:5', 'notice:1', 'notice:2'],
    );
    expect([for (final i in inbox.items) i.unread], [true, true, false]);
    expect(inbox.unreadCount, 2);
    expect(inbox.items.first.title, '10월 19일 주보');
    expect(store.saved?.since, now.subtract(NotificationInbox.firstRunGrace));
  });

  test('비로그인은 공개 공지 · 주보만 묻는다 — 회원 공지 · 새가족 신청은 묻지 않는다', () async {
    setUpInbox();

    await inbox.refresh();

    expect(backend.paths, ['GET /posts', 'GET /bulletins']);
  });

  test('회원이 로그인하면 스스로 다시 세고 회원 공지도 넣는다', () async {
    backend.memberPosts = [
      post('9', 'NOTICE_MEMBER', now.subtract(const Duration(hours: 1))),
    ];
    setUpInbox();
    await inbox.refresh();
    expect(inbox.unreadCount, 0);

    await loginAs('MEMBER');

    expect(inbox.items.single.kind, InboxKind.memberNotice);
    expect(inbox.unreadCount, 1);
    expect(backend.paths, isNot(contains('GET /admin/notifications')));
  });

  test('임원은 새가족 신청을 서버의 안 읽은 수 그대로 센다 (20건에서 잘려도)', () async {
    backend.newcomers = {
      'unreadCount': 25,
      'items': [
        {
          'type': 'NEWCOMER',
          'refId': '14',
          'subject': '박새가족',
          'createdAt': '2026-10-19T10:00:00Z',
        },
      ],
      'hasMore': true,
      'readMarker': '2026-10-19T10:00:00Z',
    };
    setUpInbox();

    await loginAs('LEADER');

    expect(inbox.unreadCount, 25);
    expect(inbox.items.single.kind, InboxKind.newcomer);
    expect(inbox.items.single.title, '박새가족');
  });

  test('모두 읽으면 숫자가 0 — 새가족은 목록을 받은 시각까지만 서버에 읽음으로', () async {
    backend
      ..publicPosts = [
        post('1', 'NOTICE_PUBLIC', now.subtract(const Duration(days: 1))),
      ]
      ..newcomers = {
        'unreadCount': 1,
        'items': [
          {
            'type': 'NEWCOMER',
            'refId': '14',
            'subject': '박새가족',
            'createdAt': '2026-10-19T10:00:00Z',
          },
        ],
        'hasMore': false,
        'readMarker': '2026-10-19T10:00:00Z',
      };
    setUpInbox();
    await loginAs('LEADER');
    expect(inbox.unreadCount, 2);

    await inbox.markAllRead();

    expect(inbox.unreadCount, 0);
    expect(inbox.items.every((i) => !i.unread), isTrue);
    expect(store.saved?.keys, ['notice:1']);
    final read = backend.server.requests.last;
    expect(read.path, '/admin/notifications/read');
    expect(read.data, {'until': '2026-10-19T10:00:00Z'});
  });

  test('읽은 뒤에 올라온 글만 새 알림이다', () async {
    backend.publicPosts = [
      post('1', 'NOTICE_PUBLIC', now.subtract(const Duration(days: 1))),
    ];
    setUpInbox();
    await inbox.refresh();
    await inbox.markAllRead();

    backend.publicPosts = [
      post('2', 'NOTICE_PUBLIC', now),
      ...backend.publicPosts,
    ];
    await inbox.refresh();

    expect(inbox.unreadCount, 1);
    expect(inbox.items.first.key, 'notice:2');
    expect(inbox.items.first.unread, isTrue);
  });

  test('본 알림은 앱을 다시 켜도 기억한다', () async {
    backend.publicPosts = [
      post('1', 'NOTICE_PUBLIC', now.subtract(const Duration(days: 1))),
    ];
    setUpInbox();
    await inbox.refresh();
    await inbox.markAllRead();
    final saved = store.saved;

    setUpInbox();
    store.saved = saved;
    await inbox.refresh();

    expect(inbox.unreadCount, 0);
  });

  test('한 목록이 실패해도 나머지로 센다', () async {
    backend
      ..failBulletins = true
      ..publicPosts = [post('1', 'NOTICE_PUBLIC', now)];
    setUpInbox();

    await inbox.refresh();

    expect(inbox.unreadCount, 1);
  });

  group('화면', () {
    Widget app(Widget child) => MaterialApp(
      home: InboxScope(inbox: inbox, child: child),
    );

    testWidgets('종에 안 본 수가 달리고, 알림함을 열면 새것에 점을 남긴 채 0이 된다', (tester) async {
      backend.publicPosts = [post('1', 'NOTICE_PUBLIC', now)];
      setUpInbox();
      await tester.runAsync(inbox.refresh);
      await tester.pumpWidget(
        app(
          Scaffold(
            appBar: AppBar(actions: [NotificationBell(onPressed: () {})]),
          ),
        ),
      );
      expect(find.text('1'), findsOneWidget);
      expect(find.byTooltip('알림 1개'), findsOneWidget);

      final semantics = tester.ensureSemantics();
      final opened = <InboxItem>[];
      await tester.pumpWidget(
        app(NotificationsScreen(inbox: inbox, onOpen: opened.add)),
      );
      await tester.pumpAndSettle();

      expect(find.text('글 1'), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp('새 알림')), findsOneWidget);
      expect(inbox.unreadCount, 0);

      await tester.tap(find.text('글 1'));
      expect(opened.single.refId, '1');
      semantics.dispose();
    });

    testWidgets('알림이 없으면 그렇다고 말한다', (tester) async {
      setUpInbox();
      await tester.pumpWidget(
        app(NotificationsScreen(inbox: inbox, onOpen: (_) {})),
      );
      await tester.pumpAndSettle();

      expect(find.text('최근 30일 동안 새 소식이 없어요.'), findsOneWidget);
    });
  });
}
