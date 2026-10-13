import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/app/app.dart';

import '../support/fake_server.dart';

Map<String, dynamic> notice(String id, String title, String category) => {
  'id': id,
  'category': category,
  'title': title,
  'slug': null,
  'pinned': false,
  'authorName': '김도연a',
  'publishedAt': '2026-10-0${id}T03:00:00Z',
  'attachmentCount': 0,
};

FakeResponse page(List<Object> items) => respond(200, {
  'data': {'items': items, 'page': 0, 'size': 20, 'hasNext': false},
});

/// 로그인 여부를 기억하는 가짜 서버. 회원 글은 로그인해야 열린다
class FakeBackend {
  var loggedIn = false;

  late final server = FakeServer((RequestOptions o) async {
    switch ((o.method, o.path)) {
      case ('POST', '/auth/login'):
        loggedIn = true;
        return respond(200, {
          'data': {'id': '42', 'name': '김도연a', 'role': 'MEMBER'},
        });
      case ('GET', '/auth/me'):
        return loggedIn
            ? respond(200, {
                'data': {
                  'id': '42',
                  'name': '김도연a',
                  'loginId': 'doyeon01',
                  'phone': '010-1234-5678',
                  'role': 'MEMBER',
                },
              })
            : unauthorized();
      case ('POST', '/auth/refresh'):
        return unauthorized();
      case ('POST', '/auth/logout'):
        loggedIn = false;
        return respond(204);
      case ('GET', '/posts'):
        return switch (o.queryParameters['category']) {
          'NOTICE_MEMBER' when loggedIn => page([
            notice('5', '회원 공지', 'NOTICE_MEMBER'),
          ]),
          'NOTICE_MEMBER' => unauthorized(),
          _ => page([notice('3', '공개 공지', 'NOTICE_PUBLIC')]),
        };
      case ('GET', '/posts/5'):
        return loggedIn
            ? respond(200, {
                'data': {
                  ...notice('5', '회원 공지', 'NOTICE_MEMBER'),
                  'body': {'type': 'doc', 'content': []},
                  'attachments': [],
                },
              })
            : unauthorized();
      default:
        return respond(200, {'data': null});
    }
  });
}

Future<FakeBackend> pumpApp(
  WidgetTester tester, {
  bool loggedIn = false,
}) async {
  tester.view.physicalSize = const Size(411, 914) * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  final backend = FakeBackend()..loggedIn = loggedIn;
  await tester.pumpWidget(LightApp(api: clientFor(backend.server)));
  await tester.pumpAndSettle();
  return backend;
}

Finder tab(String label) =>
    find.descendant(of: find.byType(NavigationBar), matching: find.text(label));

Future<void> login(WidgetTester tester) async {
  await tester.enterText(find.byType(TextFormField).at(0), 'doyeon01');
  await tester.enterText(find.byType(TextFormField).at(1), '비밀번호12!');
  await tester.tap(find.widgetWithText(FilledButton, '로그인하기'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('소식 탭에서 로그인하면 돌아와서 회원 공지까지 보인다', (tester) async {
    await pumpApp(tester);
    await tester.tap(tab('소식'));
    await tester.pumpAndSettle();
    expect(find.text('공개 공지'), findsOneWidget);
    expect(find.text('회원 공지'), findsNothing);

    await tester.tap(find.text('로그인하면 회원 공지도 볼 수 있어요.'));
    await tester.pumpAndSettle();
    await login(tester);

    // 로그인 화면이 닫히고 소식 탭으로 돌아왔다
    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.text('회원 공지'), findsOneWidget);
    expect(find.text('공개 공지'), findsOneWidget);
    expect(find.text('로그인하면 회원 공지도 볼 수 있어요.'), findsNothing);
  });

  testWidgets('앱을 켤 때 지난 로그인이 살아 있으면 회원 공지가 바로 보인다', (tester) async {
    await pumpApp(tester, loggedIn: true);

    await tester.tap(tab('소식'));
    await tester.pumpAndSettle();

    expect(find.text('회원 공지'), findsOneWidget);
  });

  testWidgets('회원 글에서 로그인 안내를 보고 로그인하면 그 글이 열린다', (tester) async {
    final backend = await pumpApp(tester, loggedIn: true);
    await tester.tap(tab('소식'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('회원 공지'));
    await tester.pumpAndSettle();
    expect(find.text('김도연a · 2026.10.05'), findsOneWidget);

    // 보는 도중에 세션이 끊겼다고 치고, 다시 들어온다
    backend.loggedIn = false;
    await tester.pageBack();
    await tester.pumpAndSettle();
    await tester.tap(find.text('회원 공지'));
    await tester.pumpAndSettle();
    expect(find.text('로그인하면 볼 수 있어요.'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, '로그인'));
    await tester.pumpAndSettle();
    await login(tester);

    expect(find.text('김도연a · 2026.10.05'), findsOneWidget);
  });

  testWidgets('로그인하던 세션이 끊기면 알리고 회원 공지를 거둔다', (tester) async {
    final backend = await pumpApp(tester, loggedIn: true);
    await tester.tap(tab('소식'));
    await tester.pumpAndSettle();
    expect(find.text('회원 공지'), findsOneWidget);

    backend.loggedIn = false;
    await tester.fling(find.text('공개 공지'), const Offset(0, 400), 1000);
    await tester.pumpAndSettle();

    expect(find.text('로그인이 만료됐어요. 다시 로그인해 주세요.'), findsOneWidget);
    expect(find.text('회원 공지'), findsNothing);
    expect(find.text('공개 공지'), findsOneWidget);
  });

  testWidgets('사이드바 머리에 로그인 상태를 보인다', (tester) async {
    await pumpApp(tester);
    await tester.tap(find.byTooltip('전체 메뉴'));
    await tester.pumpAndSettle();

    await tester.tap(
      find.descendant(
        of: find.byType(Drawer),
        matching: find.widgetWithText(OutlinedButton, '로그인'),
      ),
    );
    await tester.pumpAndSettle();
    await login(tester);

    await tester.tap(find.byTooltip('전체 메뉴'));
    await tester.pumpAndSettle();
    expect(find.text('김도연a님 · 일반 회원'), findsOneWidget);
  });

  testWidgets('사람 버튼 — 비로그인은 로그인 화면, 로그인하면 마이페이지', (tester) async {
    await pumpApp(tester);

    await tester.tap(find.byTooltip('로그인 · 회원가입'));
    await tester.pumpAndSettle();
    await login(tester);
    // 로그인을 마치면 연 화면(홈)으로 돌아온다

    await tester.tap(find.byTooltip('마이페이지'));
    await tester.pumpAndSettle();
    expect(find.text('마이페이지'), findsOneWidget);
    expect(find.text('김도연a'), findsOneWidget);
  });
}
