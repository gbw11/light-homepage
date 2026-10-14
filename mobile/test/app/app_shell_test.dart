import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:light_mobile/app/app.dart';
import 'package:light_mobile/app/paths.dart';
import 'package:light_mobile/features/church/organization_screen.dart';

import '../support/fake_server.dart';

FakeServer emptyServer() => FakeServer(
  (_) async => respond(200, {
    'data': {'items': [], 'page': 0, 'size': 3, 'hasNext': false},
  }),
);

Future<FakeServer> pumpApp(
  WidgetTester tester, {
  Size screen = const Size(411, 914),
  double textScale = 1,
}) async {
  tester.view.physicalSize = screen * 3;
  tester.view.devicePixelRatio = 3;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

  final server = emptyServer();
  await tester.pumpWidget(LightApp(api: clientFor(server)));
  await tester.pumpAndSettle();
  return server;
}

/// 홈이 공지를 부른 횟수. 공지 탭도 /posts를 부르므로 홈의 요청(size=3)만 센다
int homeNoticeCalls(FakeServer server) => server.requests
    .where((r) => r.path == '/posts' && r.queryParameters['size'] == 3)
    .length;

int selectedTab(WidgetTester tester) =>
    tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex;

/// 안드로이드 시스템 뒤로가기
Future<void> pressSystemBack(WidgetTester tester) async {
  await tester.binding.defaultBinaryMessenger.handlePlatformMessage(
    'flutter/navigation',
    SystemChannels.navigation.codec.encodeMethodCall(
      const MethodCall('popRoute'),
    ),
    (_) {},
  );
  await tester.pumpAndSettle();
}

Finder tab(String label) =>
    find.descendant(of: find.byType(NavigationBar), matching: find.text(label));

void main() {
  testWidgets('하단 탭 4개가 있고 홈에서 시작한다 — 더보기 탭은 없다', (tester) async {
    await pumpApp(tester);

    for (final label in ['홈', '말씀', '공지', '자료']) {
      expect(tab(label), findsOneWidget);
    }
    expect(tab('더보기'), findsNothing);
    expect(selectedTab(tester), 0);
    expect(find.text('주일 14:00 · 드림센터 4층'), findsOneWidget);
  });

  testWidgets('탭을 누르면 그 화면으로 간다', (tester) async {
    await pumpApp(tester);

    await tester.tap(tab('자료'));
    await tester.pumpAndSettle();

    expect(selectedTab(tester), 3);
    // 비로그인 — 회원 전용이라는 안내와 [로그인]
    expect(find.textContaining('회원 전용 자료예요'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, '로그인'), findsOneWidget);
  });

  testWidgets('다른 탭에 다녀와도 홈을 다시 불러오지 않는다 (탭 상태 유지)', (tester) async {
    final server = await pumpApp(tester);
    expect(homeNoticeCalls(server), 1);

    await tester.tap(tab('공지'));
    await tester.pumpAndSettle();
    await tester.tap(tab('홈'));
    await tester.pumpAndSettle();

    expect(selectedTab(tester), 0);
    expect(homeNoticeCalls(server), 1);
  });

  testWidgets('홈의 「공지 전체보기」는 공지 탭으로 간다', (tester) async {
    await pumpApp(tester);

    await tester.tap(find.text('공지 전체보기 ›'));
    await tester.pumpAndSettle();

    expect(selectedTab(tester), 2);
  });

  testWidgets('홈에서 공지를 누르면 홈 탭 안에서 상세가 열리고, 뒤로가기로 돌아온다', (tester) async {
    tester.view.physicalSize = const Size(411, 914) * 3;
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final server = FakeServer(
      (o) async => switch (o.path) {
        '/posts' => respond(200, {
          'data': {
            'items': [
              {
                'id': '18',
                'category': 'NOTICE_PUBLIC',
                'title': '수련회 안내',
                'slug': null,
                'pinned': false,
                'authorName': null,
                'publishedAt': '2026-10-05T03:00:00Z',
                'attachmentCount': 0,
              },
            ],
            'page': 0,
            'size': 3,
            'hasNext': false,
          },
        }),
        '/posts/18' => respond(200, {
          'data': {
            'id': '18',
            'category': 'NOTICE_PUBLIC',
            'title': '수련회 안내',
            'body': {'type': 'doc', 'content': []},
            'pinned': false,
            'authorName': '김도연a',
            'publishedAt': '2026-10-05T03:00:00Z',
            'attachments': [],
          },
        }),
        _ => respond(200, {'data': null}),
      },
    );
    await tester.pumpWidget(LightApp(api: clientFor(server)));
    await tester.pumpAndSettle();

    await tester.tap(find.text('수련회 안내'));
    await tester.pumpAndSettle();

    expect(selectedTab(tester), 0);
    expect(find.text('김도연a · 2026.10.05'), findsOneWidget);

    await pressSystemBack(tester);

    expect(find.text('주일 14:00 · 드림센터 4층'), findsOneWidget);
  });

  testWidgets('홈의 「오시는 길」은 탭을 덮고 열리고, 뒤로가기로 닫힌다', (tester) async {
    await pumpApp(tester);

    await tester.tap(find.text('오시는 길'));
    await tester.pumpAndSettle();

    expect(find.text('카카오맵'), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);

    await pressSystemBack(tester);

    expect(find.text('주일 14:00 · 드림센터 4층'), findsOneWidget);
  });

  testWidgets('☰를 누르면 사이드바가 열리고, 메뉴를 누르면 그 화면을 연다', (tester) async {
    await pumpApp(tester);

    await tester.tap(find.byTooltip('전체 메뉴'));
    await tester.pumpAndSettle();
    expect(find.byType(Drawer), findsOneWidget);

    await tester.tap(find.text('예배와 모임'));
    await tester.pumpAndSettle();

    expect(find.text('마을모임'), findsWidgets);
    await pressSystemBack(tester);
    // 돌아왔을 때 사이드바는 닫혀 있다
    expect(find.byType(Drawer), findsNothing);
    expect(selectedTab(tester), 0);
  });

  testWidgets('사이드바를 연 채 뒤로가기를 누르면 사이드바만 닫힌다 — 탭은 그대로다', (tester) async {
    await pumpApp(tester);
    await tester.tap(tab('공지'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('전체 메뉴'));
    await tester.pumpAndSettle();
    expect(find.byType(Drawer), findsOneWidget);

    await pressSystemBack(tester);

    expect(find.byType(Drawer), findsNothing);
    expect(selectedTab(tester), 2);

    // 사이드바가 닫힌 뒤의 뒤로가기는 원래대로 홈으로 간다
    await pressSystemBack(tester);
    expect(selectedTab(tester), 0);
  });

  testWidgets('홈에서도 사이드바를 연 채 뒤로가기를 누르면 앱이 아니라 사이드바가 닫힌다', (tester) async {
    await pumpApp(tester);
    await tester.tap(find.byTooltip('전체 메뉴'));
    await tester.pumpAndSettle();

    await pressSystemBack(tester);

    expect(find.byType(Drawer), findsNothing);
    expect(find.text('주일 14:00 · 드림센터 4층'), findsOneWidget);
  });

  testWidgets('사이드바 바로가기는 하단 탭을 옮긴다', (tester) async {
    await pumpApp(tester);

    await tester.tap(find.byTooltip('전체 메뉴'));
    await tester.pumpAndSettle();
    await tester.tap(
      find.descendant(of: find.byType(Drawer), matching: find.text('공지')),
    );
    await tester.pumpAndSettle();

    expect(selectedTab(tester), 2);
    expect(find.byType(Drawer), findsNothing);
  });

  testWidgets('다른 탭에서도 ☰로 같은 사이드바를 연다', (tester) async {
    await pumpApp(tester);
    await tester.tap(tab('공지'));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('전체 메뉴'));
    await tester.pumpAndSettle();

    expect(find.text('처음 오시는 분'), findsOneWidget);
  });

  testWidgets('홈이 아닌 탭에서 뒤로가기를 누르면 앱이 닫히지 않고 홈으로 온다', (tester) async {
    await pumpApp(tester);
    await tester.tap(tab('공지'));
    await tester.pumpAndSettle();
    expect(selectedTab(tester), 2);

    await pressSystemBack(tester);

    expect(selectedTab(tester), 0);
    expect(find.text('주일 14:00 · 드림센터 4층'), findsOneWidget);
  });

  testWidgets('비로그인이면 오른쪽 위 사람 버튼은 곧장 로그인 화면 — 뒤로가기로 그 탭에 돌아온다', (
    tester,
  ) async {
    await pumpApp(tester);
    await tester.tap(tab('공지'));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('로그인 · 회원가입'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(FilledButton, '로그인하기'), findsOneWidget);
    expect(find.text('마이페이지'), findsNothing);

    await pressSystemBack(tester);
    expect(find.widgetWithText(FilledButton, '로그인하기'), findsNothing);
    expect(selectedTab(tester), 2);
  });

  testWidgets('작은 폰(360dp)에서 글자를 2배로 키워도 탭 바가 넘치지 않는다', (tester) async {
    await pumpApp(tester, screen: const Size(360, 740), textScale: 2);

    expect(tester.takeException(), isNull);
    for (final label in ['홈', '말씀', '공지', '자료']) {
      expect(tab(label), findsOneWidget);
    }
  });
  // 사이드바 메뉴 구성과 상관없이 주소만으로 확인한다
  testWidgets('/organization 은 준비 중 화면이 아니라 조직도를 탭 위에 연다', (tester) async {
    await pumpApp(tester);

    GoRouter.of(tester.element(find.byType(NavigationBar)))
        .push(AppPaths.organization);
    await tester.pumpAndSettle();

    expect(find.byType(OrganizationScreen), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
  });
}
