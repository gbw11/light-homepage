import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/content/contact.dart';
import 'package:light_mobile/content/location.dart';
import 'package:light_mobile/content/organization.dart';
import 'package:light_mobile/content/parking.dart';
import 'package:light_mobile/content/welcome.dart';
import 'package:light_mobile/core/theme/app_theme.dart';
import 'package:light_mobile/features/church/about_screen.dart';
import 'package:light_mobile/features/church/contact_screen.dart';
import 'package:light_mobile/features/church/info_widgets.dart';
import 'package:light_mobile/features/church/location_screen.dart';
import 'package:light_mobile/features/church/organization_screen.dart';
import 'package:light_mobile/features/church/route_map.dart';
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
    );

    testWidgets('맨 위는 엠블럼과 WELCOME TO LIGHT — 빨간 경고 상자는 없다', (tester) async {
      await pumpScreen(tester, screen(Recorder()));

      expect(find.text('WELCOME TO LIGHT'), findsOneWidget);
      // 로고 리본 글자 같은 세리프
      expect(
        tester.widget<Text>(find.text('WELCOME TO LIGHT')).style?.fontFamily,
        displayFontFamily,
      );
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

    testWidgets('「예배만 참석하고 가셔도 괜찮아요」는 예배 종료 칸 아래에 있다', (tester) async {
      await pumpScreen(tester, screen(Recorder()));

      final note = find.text('예배만 참석하고 가셔도 괜찮아요');
      await tester.scrollUntilVisible(note, 200);
      expect(note, findsOneWidget);
      final end = tester.getRect(find.text('예배 종료 · 교제'));
      final noteRect = tester.getRect(note);
      // 예배 종료 바로 아래, 같은 들여쓰기
      expect(noteRect.top, greaterThan(end.top));
      expect(noteRect.left, end.left);
      expect(
        noteRect.top,
        lessThan(tester.getRect(find.text('마을모임 (30분)')).top),
      );
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

    testWidgets('새가족 온라인 등록은 맨 위, 오시는 길 자세히는 그 아래', (tester) async {
      final r = Recorder();
      await pumpScreen(tester, screen(r));

      // 첫 화면에서 바로 보인다 — 내리지 않아도 누를 수 있다
      expect(
        tester.getTopLeft(find.text('새가족 온라인 등록')).dy,
        lessThan(tester.getTopLeft(find.text('드림센터를 찾아오세요')).dy),
      );
      await tester.tap(find.text('새가족 온라인 등록'));
      await tester.ensureVisible(find.text('오시는 길 자세히'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('오시는 길 자세히'));

      expect(r.calls, ['register', 'directions']);
      // 지도 앱 버튼은 오시는 길 화면에만 있다 (2026-10-19)
      expect(find.text('지도 앱으로 열기'), findsNothing);
      // 남은 버튼은 카드 오른쪽 끝에 붙는다 — 안내 글(왼쪽에서 시작)보다 오른쪽
      final button = find.widgetWithText(FilledButton, '오시는 길 자세히');
      final text = find.textContaining('도보 2분');
      expect(
        tester.getTopRight(button).dx,
        greaterThan(tester.getTopRight(text).dx - 1),
      );
      expect(
        tester.getTopLeft(button).dx,
        greaterThan(tester.getTopLeft(text).dx),
      );
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

    testWidgets('주소와 지도 앱 버튼 셋이 첫 화면에 있다', (tester) async {
      final r = Recorder();
      await pumpScreen(tester, screen(r));

      expect(find.text(address), findsOneWidget);
      await tester.tap(find.text('카카오맵'));
      await tester.tap(find.text('네이버지도'));
      await tester.tap(find.text('구글지도'));

      expect(r.calls, [
        'open:$kakaoMapAppUrl',
        'open:$naverMapAppUrl',
        'open:$googleMapUrl',
      ]);
    });

    testWidgets('지도 버튼 셋은 한 줄에 같은 크기의 앱 아이콘이다 (구글만 작은 링크였다)', (tester) async {
      final semantics = tester.ensureSemantics();
      await pumpScreen(tester, screen(Recorder()));

      Finder iconOf(String asset) => find.byWidgetPredicate(
        (w) =>
            w is Image &&
            w.image is AssetImage &&
            (w.image as AssetImage).assetName ==
                'assets/images/map_apps/$asset.webp',
      );
      for (final asset in ['kakao_map', 'naver_map', 'google_map']) {
        expect(iconOf(asset), findsOneWidget, reason: asset);
      }
      Rect rectOf(String asset) => tester.getRect(iconOf(asset));
      expect(rectOf('google_map').size, rectOf('kakao_map').size);
      expect(rectOf('naver_map').size, rectOf('kakao_map').size);
      expect(rectOf('google_map').top, rectOf('kakao_map').top);
      // 스크린 리더는 버튼 하나로 읽는다
      expect(find.bySemanticsLabel('네이버지도 열기'), findsOneWidget);
      semantics.dispose();
      expect(find.textContaining('구글 지도로 보기'), findsNothing);
      // 버튼 아래 안내 글도 없다 (2026-10-19)
      expect(find.textContaining('약도는 길을 알려주는 그림'), findsNothing);
    });

    testWidgets('지도 앱 주소는 드림센터 주소로 검색한다 (웹과 같은 링크)', (tester) async {
      final encoded = Uri.encodeComponent(address);
      expect(kakaoMapUrl, 'https://map.kakao.com/link/search/$encoded');
      expect(naverMapUrl, 'https://map.naver.com/p/search/$encoded');
      // 앱 주소는 앱이 없으면 위 웹 주소로 넘어간다
      expect(kakaoMapAppUrl, 'kakaomap://search?q=$encoded');
      expect(
        naverMapAppUrl,
        'nmap://search?query=$encoded&appname=kr.light.app',
      );
      expect(appUrlFallbacks, {
        kakaoMapAppUrl: kakaoMapUrl,
        naverMapAppUrl: naverMapUrl,
      });
      expect(
        googleMapUrl,
        'https://www.google.com/maps/search/?api=1&query=$encoded',
      );
    });

    testWidgets('약도 두 장을 그리고, 스크린 리더에는 길 설명을 읽힌다', (tester) async {
      final semantics = tester.ensureSemantics();
      await pumpScreen(tester, screen(Recorder()));

      expect(find.byType(RouteMap), findsOneWidget);
      expect(
        find.bySemanticsLabel(RegExp('본당에서 드림센터까지 가는 약도')),
        findsOneWidget,
      );

      await tester.scrollUntilVisible(find.byType(ParkingMap), 300);
      expect(
        find.bySemanticsLabel(RegExp('주차장 세 곳에서 드림센터로 가는 약도')),
        findsOneWidget,
      );
      semantics.dispose();
    });

    testWidgets('약도를 누르면 전체 화면에서 확대해 본다', (tester) async {
      await pumpScreen(tester, screen(Recorder()));

      await tester.tap(find.byType(RouteMap));
      await tester.pumpAndSettle();

      expect(find.text('본당에서 오는 길'), findsOneWidget);
      expect(find.byType(InteractiveViewer), findsOneWidget);
      expect(find.byType(RouteMap), findsWidgets);

      await tester.tap(find.byType(CloseButton));
      await tester.pumpAndSettle();
      expect(find.byType(InteractiveViewer), findsNothing);
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
  group('조직도', () {
    testWidgets('웹과 같은 소개 문구와 세 묶음(임원단 · 마을 · 팀)을 보여준다', (tester) async {
      await pumpScreen(tester, const OrganizationScreen());

      expect(find.text('조직도'), findsOneWidget);
      expect(find.textContaining('팀은 지원제로 운영됩니다'), findsOneWidget);
      for (final title in ['임원단', '마을 (9개)', '팀']) {
        await tester.scrollUntilVisible(find.text(title), 200);
      }
      expect(find.textContaining('1인 1마을'), findsOneWidget);
      expect(find.textContaining('마을 소속과 별개입니다'), findsOneWidget);
    });

    testWidgets('임원 4칸은 2열이다', (tester) async {
      await pumpScreen(tester, const OrganizationScreen());

      for (var i = 1; i <= officerCount; i++) {
        await tester.scrollUntilVisible(find.text('임원 $i'), 200);
      }
      expect(officerCount, 4);
      // 1·2번이 한 줄, 3번은 그 아래 줄 왼쪽
      final one = tester.getTopLeft(find.text('임원 1'));
      final two = tester.getTopLeft(find.text('임원 2'));
      final three = tester.getTopLeft(find.text('임원 3'));
      expect(two.dy, one.dy);
      expect(two.dx, greaterThan(one.dx));
      expect(three.dx, one.dx);
      expect(three.dy, greaterThan(one.dy));
    });

    testWidgets('마을 9개를 촌장 · 마을원 자리와 함께 보여준다', (tester) async {
      await pumpScreen(tester, const OrganizationScreen());

      for (var i = 1; i <= villageCount; i++) {
        await tester.scrollUntilVisible(find.text('마을 $i'), 200);
      }
      expect(find.text('마을 10'), findsNothing);
      expect(villageCount, 9);
    });

    testWidgets('팀 6개를 팀장 자리만 두고 보여준다', (tester) async {
      await pumpScreen(tester, const OrganizationScreen());

      expect(teams, hasLength(6));
      for (final team in teams) {
        await tester.scrollUntilVisible(find.text(team), 200);
      }
      // 마지막 팀(선교팀) 카드까지 내려왔다 — 팀마다 팀장 한 줄뿐이다
      await tester.scrollUntilVisible(find.text('팀장: $unknownLabel').last, 200);
      for (final role in ['총무', '회계', '팀원']) {
        expect(find.textContaining('$role:'), findsNothing);
      }
    });

    testWidgets('작은 폰(360dp)에서 글자를 2배로 키워도 넘치지 않는다', (tester) async {
      await pumpScreen(
        tester,
        const OrganizationScreen(),
        textScale: 2,
        size: const Size(360, 740),
      );
      await expectNoOverflowToEnd(tester);
    });
  });
}
