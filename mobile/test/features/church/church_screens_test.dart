import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/content/contact.dart';
import 'package:light_mobile/content/location.dart';
import 'package:light_mobile/content/parking.dart';
import 'package:light_mobile/content/welcome.dart';
import 'package:light_mobile/core/theme/app_theme.dart';
import 'package:light_mobile/features/church/about_screen.dart';
import 'package:light_mobile/features/church/contact_screen.dart';
import 'package:light_mobile/features/church/info_widgets.dart';
import 'package:light_mobile/features/church/location_screen.dart';
import 'package:light_mobile/features/church/welcome_screen.dart';
import 'package:light_mobile/features/church/worship_screen.dart';

/// 화면이 바깥에 알린 일 (화면 이동 · 바깥 주소 열기)
class Recorder {
  final calls = <String>[];

  void Function() call(String name) =>
      () => calls.add(name);
  void open(String url) => calls.add('open:$url');
}

Future<void> pumpScreen(
  WidgetTester tester,
  Widget screen, {
  double textScale = 1,
  Size size = const Size(411, 914),
}) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      theme: buildAppTheme(),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context)
            .copyWith(textScaler: TextScaler.linear(textScale)),
        child: child!,
      ),
      home: screen,
    ),
  );
  await tester.pumpAndSettle();
}

/// 화면 끝까지 내리며 넘침이 없는지 본다
Future<void> expectNoOverflowToEnd(WidgetTester tester) async {
  expect(tester.takeException(), isNull);
  final list = find.byType(Scrollable).first;
  for (var i = 0; i < 30; i++) {
    await tester.drag(list, const Offset(0, -500));
    await tester.pump();
    expect(tester.takeException(), isNull);
  }
}

void main() {
  group('처음 오시는 분', () {
    Widget screen(Recorder r) => WelcomeScreen(
      onDirections: r.call('directions'),
      onRegister: r.call('register'),
      openExternal: r.open,
    );

    testWidgets('맨 위는 엠블럼과 WELCOME TO LIGHT — 빨간 경고 상자는 없다', (tester) async {
      await pumpScreen(tester, screen(Recorder()));

      expect(find.text('WELCOME TO LIGHT'), findsOneWidget);
      expect(find.textContaining('환영합니다'), findsNothing);
      expect(find.byType(VenueWarning), findsNothing);
      expect(find.text('드림센터를 찾아오세요'), findsOneWidget);
      expect(find.textContaining('도보 2분 (134m)'), findsOneWidget);
    });

    testWidgets('주일 흐름을 시각 순서대로 보여준다', (tester) async {
      await pumpScreen(tester, screen(Recorder()));

      for (final step in sundayTimeline) {
        await tester.scrollUntilVisible(find.text(step.label), 200);
      }
    });

    testWidgets('자주 묻는 질문을 누르면 답이 펼쳐진다', (tester) async {
      await pumpScreen(tester, screen(Recorder()));
      final faq = welcomeFaq.first;

      await tester.scrollUntilVisible(find.text(faq.question), 300);
      // scrollUntilVisible은 화면 끝에 걸치게만 올려서 탭이 빗나갈 수 있다
      await tester.ensureVisible(find.text(faq.question));
      await tester.pumpAndSettle();
      expect(find.text(faq.answer), findsNothing);
      await tester.tap(find.text(faq.question));
      await tester.pumpAndSettle();

      expect(find.text(faq.answer), findsOneWidget);
    });

    testWidgets('새가족 온라인 등록은 맨 위, 지도 · 오시는 길은 그 아래', (tester) async {
      final r = Recorder();
      await pumpScreen(tester, screen(r));

      // 첫 화면에서 바로 보인다 — 내리지 않아도 누를 수 있다
      expect(
        tester.getTopLeft(find.text('새가족 온라인 등록')).dy,
        lessThan(tester.getTopLeft(find.text('드림센터를 찾아오세요')).dy),
      );
      await tester.tap(find.text('새가족 온라인 등록'));
      for (final label in ['지도 앱으로 열기', '오시는 길 자세히']) {
        await tester.ensureVisible(find.text(label));
        await tester.pumpAndSettle();
        await tester.tap(find.text(label));
      }

      expect(r.calls, ['register', 'open:$kakaoMapUrl', 'directions']);
    });

    testWidgets('웹에서 ❓(확인 필요)로 남은 내용은 옮기지 않는다', (tester) async {
      await pumpScreen(tester, screen(Recorder()));

      expect(find.textContaining('❓'), findsNothing);
      expect(find.textContaining('확인 필요'), findsNothing);
    });

    testWidgets('작은 폰(360dp)에서 글자를 2배로 키워도 넘치지 않는다', (tester) async {
      await pumpScreen(
        tester,
        screen(Recorder()),
        textScale: 2,
        size: const Size(360, 740),
      );
      await expectNoOverflowToEnd(tester);
    });
  });

  group('오시는 길', () {
    Widget screen(Recorder r) =>
        LocationScreen(openExternal: r.open, onFirstVisit: r.call('welcome'));

    testWidgets('주소와 지도 앱 버튼이 첫 화면에 있다', (tester) async {
      final r = Recorder();
      await pumpScreen(tester, screen(r));

      expect(find.text(address), findsOneWidget);
      await tester.tap(find.text('카카오맵'));
      await tester.tap(find.text('네이버지도'));

      expect(r.calls, ['open:$kakaoMapUrl', 'open:$naverMapUrl']);
    });

    testWidgets('주소를 복사한다', (tester) async {
      final copied = <String>[];
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (call) async {
          if (call.method == 'Clipboard.setData') {
            copied.add((call.arguments as Map)['text'] as String);
          }
          return null;
        },
      );
      addTearDown(
        () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          SystemChannels.platform,
          null,
        ),
      );
      await pumpScreen(tester, screen(Recorder()));

      await tester.tap(find.byTooltip('주소 복사'));
      await tester.pump();

      expect(copied, [address]);
      expect(find.text('주소를 복사했어요.'), findsOneWidget);
    });

    testWidgets('주차장 세 곳의 이용 시간과 출처를 보여준다', (tester) async {
      final r = Recorder();
      await pumpScreen(tester, screen(r));

      for (final lot in parkingLots) {
        await tester.scrollUntilVisible(find.text(lot.when), 300);
      }
      await tester.scrollUntilVisible(find.text('▸ 교회 주차안내 열기'), 300);
      // scrollUntilVisible은 화면 끝에 걸치게만 올려서 탭이 빗나갈 수 있다
      await tester.ensureVisible(find.text('▸ 교회 주차안내 열기'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('▸ 교회 주차안내 열기'));

      expect(r.calls, ['open:$parkingSourceUrl']);
    });

    testWidgets('작은 폰(360dp)에서 글자를 2배로 키워도 넘치지 않는다', (tester) async {
      await pumpScreen(
        tester,
        screen(Recorder()),
        textScale: 2,
        size: const Size(360, 740),
      );
      await expectNoOverflowToEnd(tester);
    });
  });

  group('예배와 모임', () {
    Widget screen(Recorder r) => WorshipScreen(
      onDirections: r.call('directions'),
      onFirstVisit: r.call('welcome'),
    );

    testWidgets('예배·모임 시간과 장소를 한 줄씩 보여준다', (tester) async {
      await pumpScreen(tester, screen(Recorder()));

      expect(find.text('주일 14:00'), findsOneWidget);
      expect(find.text('예배 후 15:30~16:00'), findsOneWidget);
      expect(find.text('드림센터 4층'), findsNWidgets(2));
    });

    testWidgets('오시는 길 · 처음 오시는 분으로 간다', (tester) async {
      final r = Recorder();
      await pumpScreen(tester, screen(r));

      await tester.tap(find.text('오시는 길'));
      await tester.tap(find.text('처음 오시는 분'));

      expect(r.calls, ['directions', 'welcome']);
    });

    testWidgets('작은 폰(360dp)에서 글자를 2배로 키워도 넘치지 않는다', (tester) async {
      await pumpScreen(
        tester,
        screen(Recorder()),
        textScale: 2,
        size: const Size(360, 740),
      );
      await expectNoOverflowToEnd(tester);
    });
  });

  group('청년교회 소개', () {
    testWidgets('LIGHT의 뜻과 두 축을 보여준다', (tester) async {
      await pumpScreen(tester, const AboutScreen());

      expect(find.text('Live In God, Help The other'), findsOneWidget);
      expect(
        find.bySemanticsLabel('Live In God, Help The other'),
        findsWidgets,
      );
      await tester.scrollUntilVisible(find.text('Help The other'), 300);
      expect(find.textContaining('❓'), findsNothing);
    });

    testWidgets('작은 폰(360dp)에서 글자를 2배로 키워도 넘치지 않는다', (tester) async {
      await pumpScreen(
        tester,
        const AboutScreen(),
        textScale: 2,
        size: const Size(360, 740),
      );
      await expectNoOverflowToEnd(tester);
    });
  });

  group('문의하기', () {
    Widget screen(Recorder r) => ContactScreen(
      openExternal: r.open,
      onFirstVisit: r.call('welcome'),
      onDirections: r.call('directions'),
    );

    testWidgets('번호를 글자로 보이고, 누르면 전화를 건다', (tester) async {
      final r = Recorder();
      await pumpScreen(tester, screen(r));

      await tester.tap(find.text(churchPhone));

      expect(r.calls, ['open:tel:0553336321']);
      // 교회 사무실로 연결된다는 안내를 빠뜨리지 않는다
      expect(find.textContaining('김해교회 사무실로 연결됩니다'), findsOneWidget);
    });

    testWidgets('처음 오시는 분 · 오시는 길로 간다', (tester) async {
      final r = Recorder();
      await pumpScreen(tester, screen(r));

      await tester.tap(find.text('처음 오시는 분'));
      await tester.tap(find.text('오시는 길'));

      expect(r.calls, ['welcome', 'directions']);
    });

    testWidgets('작은 폰(360dp)에서 글자를 2배로 키워도 넘치지 않는다', (tester) async {
      await pumpScreen(
        tester,
        screen(Recorder()),
        textScale: 2,
        size: const Size(360, 740),
      );
      await expectNoOverflowToEnd(tester);
    });
  });
}
