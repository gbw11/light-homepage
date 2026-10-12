import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/core/theme/app_theme.dart';
import 'package:light_mobile/features/posts/post_summary.dart';
import 'package:light_mobile/features/posts/posts_api.dart';
import 'package:light_mobile/features/posts/posts_list_screen.dart';

import '../../support/fake_server.dart';

Map<String, dynamic> post(String id, String title, String category) => {
  'id': id,
  'category': category,
  'title': title,
  'slug': null,
  'pinned': false,
  'authorName': '시드임원',
  'publishedAt': '2026-09-0${id}T03:00:00Z',
  'attachmentCount': 1,
};

Future<List<String>> pump(
  WidgetTester tester,
  FakeServer server,
  PostCategory category, {
  double textScale = 1,
  Size size = const Size(411, 914),
}) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final calls = <String>[];
  await tester.pumpWidget(
    MaterialApp(
      theme: buildAppTheme(),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context)
            .copyWith(textScaler: TextScaler.linear(textScale)),
        child: child!,
      ),
      home: PostsListScreen(
        posts: PostsApi(clientFor(server)),
        category: category,
        title: category == PostCategory.minutes ? '회의록' : '예산안',
        emptyMessage: '아직 없어요.',
        onOpen: (p) => calls.add(p.id),
        onLogin: () => calls.add('login'),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return calls;
}

FakeResponse page(List<Object> items) => respond(200, {
  'data': {'items': items, 'page': 0, 'size': 20, 'hasNext': false},
});

void main() {
  testWidgets('회의록을 그 분류로만 부르고, 누르면 그 글을 연다', (tester) async {
    final server = FakeServer(
      (_) async => page([
        post('8', '9월 첫째 주 임원회의록', 'MINUTES'),
        post('2', '8월 회의록', 'MINUTES'),
      ]),
    );
    final calls = await pump(tester, server, PostCategory.minutes);

    expect(server.requests.map((r) => r.queryParameters['category']).toSet(), {
      'MINUTES',
    });
    expect(find.text('9월 첫째 주 임원회의록'), findsOneWidget);
    expect(find.text('첨부 1'), findsNWidgets(2));

    await tester.tap(find.text('8월 회의록'));
    expect(calls, ['2']);
  });

  testWidgets('예산안을 권한 없이 부르면(403) 로그인을 권하지 않고 권한이 없다고 말한다', (tester) async {
    final calls = await pump(
      tester,
      FakeServer(
        (_) async => respond(403, {
          'error': {'code': 'FORBIDDEN', 'message': 'x', 'field': null},
        }),
      ),
      PostCategory.budget,
    );

    expect(find.text('이 자료를 볼 권한이 없어요.'), findsOneWidget);
    expect(find.text('로그인'), findsNothing);
    expect(calls, isEmpty);
  });

  testWidgets('세션이 끊겼으면(401) 로그인 안내를 둔다', (tester) async {
    final calls = await pump(
      tester,
      FakeServer((_) async => unauthorized()),
      PostCategory.minutes,
    );

    await tester.tap(find.widgetWithText(FilledButton, '로그인'));
    expect(calls, ['login']);
  });

  testWidgets('없으면 없다고 말한다', (tester) async {
    await pump(tester, FakeServer((_) async => page([])), PostCategory.minutes);

    expect(find.text('아직 없어요.'), findsOneWidget);
  });
}
