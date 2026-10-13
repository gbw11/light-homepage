import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/app/app_intro.dart';
import 'package:light_mobile/core/theme/app_theme.dart';

/// 인트로 아래에 깔리는 앱 본체 대신
const _body = Text('앱 본체', textDirection: TextDirection.ltr);

Widget _wrap({bool reduceMotion = false}) => MaterialApp(
  theme: buildAppTheme(),
  builder: (context, child) => MediaQuery(
    data: MediaQuery.of(context).copyWith(disableAnimations: reduceMotion),
    child: AppIntro(child: child!),
  ),
  home: const Scaffold(body: _body),
);

final _intro = find.byKey(const Key('app-intro'));

/// 글귀 줄마다 떠오른 정도 (0 = 아직, 1 = 제자리)
List<double> _risen(WidgetTester tester) => tester
    .widgetList<IntroLine>(find.byType(IntroLine))
    .map((line) => line.progress)
    .toList();

void main() {
  testWidgets('켜면 인트로가 앱 본체를 덮고, 끝나면 걷힌다', (tester) async {
    await tester.pumpWidget(_wrap());

    expect(_intro, findsOneWidget);
    // 본체는 처음부터 아래에서 그려진다 — 인트로 동안 홈이 미리 데이터를 불러온다
    expect(find.text('앱 본체'), findsOneWidget);

    await tester.pump(introDuration ~/ 2);
    expect(_intro, findsOneWidget);

    await tester.pumpAndSettle();
    expect(_intro, findsNothing);
    expect(find.text('앱 본체'), findsOneWidget);
  });

  testWidgets('LIGHT의 뜻 다섯 줄을 보여준다 (웹 첫 화면과 같은 글귀)', (tester) async {
    await tester.pumpWidget(_wrap());
    await tester.pump(introDuration * 0.7);

    final lines = tester.widgetList<IntroLine>(find.byType(IntroLine));
    expect(lines.map((l) => l.letter + l.rest), [
      'Live',
      'In',
      'God',
      'Help',
      'The other',
    ]);
    expect(_risen(tester), everyElement(1));
  });

  testWidgets('글귀는 엠블럼 직후부터 위 줄부터 한 줄씩 떠오른다', (tester) async {
    await tester.pumpWidget(_wrap());

    // 처음에는 아무 줄도 없다
    expect(_risen(tester), everyElement(0));

    // 엠블럼이 뜨는 동안 이미 첫 줄이 떠오르고 있다 (예전에는 0.5초 넘게 비어 있었다)
    await tester.pump(introDuration * 0.13);
    final early = _risen(tester);
    expect(early.first, inExclusiveRange(0, 1));
    expect(early.skip(1), everyElement(0));

    // 중간에는 앞줄은 제자리에 있고 뒷줄은 아직이다
    await tester.pump(introDuration * 0.25);
    final middle = _risen(tester);
    expect(middle.first, 1);
    expect(middle.last, 0);
  });

  testWidgets('누르면 바로 건너뛴다', (tester) async {
    await tester.pumpWidget(_wrap());
    await tester.pump(const Duration(milliseconds: 300));

    await tester.tap(_intro);
    // 건너뛰기는 0.25초 — 원래 끝나는 3초보다 훨씬 이르게 걷힌다
    for (var i = 0; i < 4; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }

    expect(_intro, findsNothing);
  });

  testWidgets('동작 줄이기면 움직임 없이 짧게 끝난다', (tester) async {
    await tester.pumpWidget(_wrap(reduceMotion: true));
    await tester.pump(const Duration(milliseconds: 50));

    // 글귀가 처음부터 다 보인다 (떠오르는 움직임이 없다)
    expect(_risen(tester), everyElement(1));

    await tester.pump(introReducedDuration);
    await tester.pump();
    expect(_intro, findsNothing);
  });

  testWidgets('인트로가 떠 있는 동안 스크린리더는 인트로만 읽는다', (tester) async {
    final semantics = tester.ensureSemantics();
    await tester.pumpWidget(_wrap());

    expect(find.bySemanticsLabel(RegExp('LIGHT — 김해교회 청년교회')), findsOneWidget);
    expect(find.bySemanticsLabel('앱 본체'), findsNothing);

    await tester.pumpAndSettle();
    expect(find.bySemanticsLabel('앱 본체'), findsOneWidget);
    semantics.dispose();
  });
}
