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

    final texts = tester
        .widgetList<RichText>(
          find.descendant(of: _intro, matching: find.byType(RichText)),
        )
        .map((t) => t.text.toPlainText())
        .toList();
    expect(texts, containsAll(['Live', 'In', 'God', 'Help', 'The other']));
  });

  testWidgets('누르면 바로 건너뛴다', (tester) async {
    await tester.pumpWidget(_wrap());
    await tester.pump(const Duration(milliseconds: 300));

    await tester.tap(_intro);
    // 건너뛰기는 0.25초 — 원래 끝나는 2.6초보다 훨씬 이르게 걷힌다
    for (var i = 0; i < 4; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }

    expect(_intro, findsNothing);
  });

  testWidgets('동작 줄이기면 움직임 없이 짧게 끝난다', (tester) async {
    await tester.pumpWidget(_wrap(reduceMotion: true));
    await tester.pump(const Duration(milliseconds: 50));

    // 글귀가 처음부터 다 보인다 (차례로 나타나는 움직임이 없다)
    final firstLine = find
        .descendant(of: _intro, matching: find.byType(FadeTransition))
        .last;
    expect(tester.widget<FadeTransition>(firstLine).opacity.value, 1);

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
