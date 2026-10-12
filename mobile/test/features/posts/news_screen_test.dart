import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/core/theme/app_theme.dart';
import 'package:light_mobile/features/posts/news_screen.dart';
import 'package:light_mobile/features/posts/post_summary.dart';
import 'package:light_mobile/features/posts/posts_api.dart';

import '../../support/fake_server.dart';

Map<String, dynamic> notice(
  String id,
  String title, {
  String category = 'NOTICE_PUBLIC',
  bool pinned = false,
  int attachments = 0,
  String day = '05',
}) => {
  'id': id,
  'category': category,
  'title': title,
  'slug': 'notice-$id',
  'pinned': pinned,
  'authorName': '김도연a',
  'publishedAt': '2026-10-${day}T03:00:00Z',
  'attachmentCount': attachments,
};

FakeResponse page(List<Object> items, {int page = 0, bool hasNext = false}) =>
    respond(200, {
      'data': {'items': items, 'page': page, 'size': 20, 'hasNext': hasNext},
    });

/// 분류별 응답. 회원 공지를 정하지 않았는데 부르면 401 — 비로그인 서버처럼
FakeServer serverWith({FakeResponse? public, FakeResponse? member}) =>
    FakeServer(
      (RequestOptions o) async => switch (o.queryParameters['category']) {
        'NOTICE_PUBLIC' => public ?? page([notice('1', '첫 공지')]),
        'NOTICE_MEMBER' => member ?? unauthorized(),
        _ => respond(404),
      },
    );

/// 분류를 바꿔 다시 그릴 수 있게 상태를 밖에 둔다 (로그인·로그아웃 흉내)
class Harness {
  final opened = <String>[];
  final categories = ValueNotifier<List<PostCategory>>(const [
    PostCategory.noticePublic,
  ]);
}

Future<Harness> pumpNews(
  WidgetTester tester,
  FakeServer server, {
  double textScale = 1,
  Size screen = const Size(411, 914),
}) async {
  tester.view.physicalSize = screen * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  final harness = Harness();
  final posts = PostsApi(clientFor(server));
  await tester.pumpWidget(
    MaterialApp(
      theme: buildAppTheme(),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context)
            .copyWith(textScaler: TextScaler.linear(textScale)),
        child: child!,
      ),
      home: ValueListenableBuilder(
        valueListenable: harness.categories,
        builder: (context, categories, _) => NewsScreen(
          posts: posts,
          categories: categories,
          onOpen: (n) => harness.opened.add(n.id),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return harness;
}

void main() {
  testWidgets('비로그인은 공개 공지만 부르고, 회원 공지가 있다는 것만 알린다', (tester) async {
    final server = serverWith();
    await pumpNews(tester, server);

    expect(find.text('첫 공지'), findsOneWidget);
    expect(find.text('로그인하면 회원 공지도 볼 수 있어요.'), findsOneWidget);
    expect(server.requests.map((r) => r.queryParameters['category']).toSet(), {
      'NOTICE_PUBLIC',
    });
  });

  testWidgets('고정 글에는 📌, 첨부가 있으면 첨부 수를 단다', (tester) async {
    await pumpNews(
      tester,
      serverWith(
        public: page([
          notice('2', '수련회 안내', pinned: true, attachments: 2),
          notice('1', '광고'),
        ]),
      ),
    );

    expect(find.byIcon(Icons.push_pin), findsOneWidget);
    expect(find.text('첨부 2'), findsOneWidget);
    expect(find.text('2026.10.05'), findsNWidgets(2));
  });

  testWidgets('로그인하면 회원 공지까지 합쳐 고정 먼저 보여준다', (tester) async {
    final harness = await pumpNews(
      tester,
      serverWith(
        public: page([notice('9', '공개 최신', day: '09')]),
        member: page([
          notice('3', '회원 고정', category: 'NOTICE_MEMBER', pinned: true),
        ]),
      ),
    );

    harness.categories.value = const [
      PostCategory.noticePublic,
      PostCategory.noticeMember,
    ];
    await tester.pumpAndSettle();

    final top = tester.getTopLeft(find.textContaining('회원 고정')).dy;
    final next = tester.getTopLeft(find.text('공개 최신')).dy;
    expect(top, lessThan(next));
    expect(find.text('로그인하면 회원 공지도 볼 수 있어요.'), findsNothing);
  });

  testWidgets('로그아웃하면 회원 공지가 바로 사라진다', (tester) async {
    final harness = await pumpNews(
      tester,
      serverWith(
        member: page([notice('3', '회원 공지', category: 'NOTICE_MEMBER')]),
      ),
    );
    harness.categories.value = const [
      PostCategory.noticePublic,
      PostCategory.noticeMember,
    ];
    await tester.pumpAndSettle();
    expect(find.text('회원 공지'), findsOneWidget);

    harness.categories.value = const [PostCategory.noticePublic];
    await tester.pump();

    expect(find.text('회원 공지'), findsNothing);
    await tester.pumpAndSettle();
    expect(find.text('첫 공지'), findsOneWidget);
  });

  testWidgets('끝까지 내리면 다음 페이지를 받는다 — 20건에서 멈추지 않는다', (tester) async {
    final server = FakeServer(
      (o) async => switch (o.queryParameters['page']) {
        0 => page([
          for (var i = 40; i > 20; i--) notice('$i', '공지 $i'),
        ], hasNext: true),
        _ => page([notice('20', '공지 20')], page: 1),
      },
    );
    await pumpNews(tester, server);

    await tester.scrollUntilVisible(find.text('공지 20'), 400);

    expect(find.text('공지 20'), findsOneWidget);
  });

  testWidgets('누르면 그 공지를 연다', (tester) async {
    final harness = await pumpNews(tester, serverWith());

    await tester.tap(find.text('첫 공지'));

    expect(harness.opened, ['1']);
  });

  testWidgets('공지가 없으면 없다고 말한다', (tester) async {
    await pumpNews(tester, serverWith(public: page([])));

    expect(find.text('등록된 공지가 없어요.'), findsOneWidget);
    // 비로그인 안내는 빈 목록에서도 남긴다
    expect(find.text('로그인하면 회원 공지도 볼 수 있어요.'), findsOneWidget);
  });

  testWidgets('못 불러오면 [다시 시도]로 다시 받는다', (tester) async {
    var fail = true;
    final server = FakeServer(
      (o) async => fail
          ? respond(500, {
              'error': {
                'code': 'INTERNAL_ERROR',
                'message': '서버 오류',
                'field': null,
              },
            })
          : page([notice('1', '첫 공지')]),
    );
    await pumpNews(tester, server);
    expect(find.textContaining('불러오지 못했어요'), findsOneWidget);

    fail = false;
    await tester.tap(find.text('다시 시도'));
    await tester.pumpAndSettle();

    expect(find.text('첫 공지'), findsOneWidget);
  });

  testWidgets('작은 폰(360dp)에서 글자를 2배로 키워도 넘치지 않는다', (tester) async {
    await pumpNews(
      tester,
      serverWith(
        public: page([
          notice(
            '2',
            '아주 긴 공지 제목이 들어오면 두 줄에서 말줄임표로 끝나야 하고 화면 밖으로 밀려나면 안 됩니다',
            pinned: true,
            attachments: 3,
          ),
          notice('1', '광고'),
        ]),
      ),
      textScale: 2,
      screen: const Size(360, 740),
    );

    expect(tester.takeException(), isNull);
  });
}
