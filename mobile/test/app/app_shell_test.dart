import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/app/app.dart';

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
  testWidgets('하단 탭 5개가 있고 홈에서 시작한다', (tester) async {
    await pumpApp(tester);

    for (final label in ['홈', '말씀', '소식', '자료', '더보기']) {
      expect(tab(label), findsOneWidget);
    }
    expect(selectedTab(tester), 0);
    expect(find.text('주일 14:00 · 청년예배'), findsOneWidget);
  });

  testWidgets('탭을 누르면 그 화면으로 간다', (tester) async {
    await pumpApp(tester);

    await tester.tap(tab('자료'));
    await tester.pumpAndSettle();

    expect(selectedTab(tester), 3);
    expect(find.text('준비 중인 화면이에요'), findsOneWidget);
    expect(find.textContaining('로그인한 회원만'), findsOneWidget);
  });

  testWidgets('다른 탭에 다녀와도 홈을 다시 불러오지 않는다 (탭 상태 유지)', (tester) async {
    final server = await pumpApp(tester);
    expect(server.paths.where((p) => p == 'GET /posts'), hasLength(1));

    await tester.tap(tab('소식'));
    await tester.pumpAndSettle();
    await tester.tap(tab('홈'));
    await tester.pumpAndSettle();

    expect(selectedTab(tester), 0);
    expect(server.paths.where((p) => p == 'GET /posts'), hasLength(1));
  });

  testWidgets('홈의 「공지 전체보기」는 소식 탭으로 간다', (tester) async {
    await pumpApp(tester);

    await tester.tap(find.text('▸ 공지 전체보기'));
    await tester.pumpAndSettle();

    expect(selectedTab(tester), 2);
  });

  testWidgets('아직 없는 화면을 누르면 준비 중이라고 알린다', (tester) async {
    await pumpApp(tester);

    await tester.tap(find.text('오시는 길'));
    await tester.pump();

    expect(find.text('준비 중인 화면이에요.'), findsOneWidget);
  });

  testWidgets('홈이 아닌 탭에서 뒤로가기를 누르면 앱이 닫히지 않고 홈으로 온다', (tester) async {
    await pumpApp(tester);
    await tester.tap(tab('더보기'));
    await tester.pumpAndSettle();
    expect(selectedTab(tester), 4);

    await pressSystemBack(tester);

    expect(selectedTab(tester), 0);
    expect(find.text('주일 14:00 · 청년예배'), findsOneWidget);
  });

  testWidgets('작은 폰(360dp)에서 글자를 2배로 키워도 탭 바가 넘치지 않는다', (tester) async {
    await pumpApp(tester, screen: const Size(360, 740), textScale: 2);

    expect(tester.takeException(), isNull);
    for (final label in ['홈', '말씀', '소식', '자료', '더보기']) {
      expect(tab(label), findsOneWidget);
    }
  });
}
