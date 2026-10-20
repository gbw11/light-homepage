import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/app/push_snack_bar.dart';
import 'package:light_mobile/core/theme/app_theme.dart';

Future<void> show(
  WidgetTester tester,
  SnackBar snackBar, {
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
      home: Scaffold(
        body: Builder(
          builder: (context) => Center(
            child: TextButton(
              onPressed: () =>
                  ScaffoldMessenger.of(context).showSnackBar(snackBar),
              child: const Text('열기'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('열기'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('제목과 내용을 두 줄로 — 제목은 굵게, 내용은 따로', (tester) async {
    final opened = <String>[];
    await show(
      tester,
      pushSnackBar((
        title: '[공지] 가을 수련회 안내',
        body: '새 공지가 올라왔어요.',
        data: const {},
      ), onOpen: () => opened.add('open'))!,
    );

    final title = tester.widget<Text>(find.text('[공지] 가을 수련회 안내'));
    final body = tester.widget<Text>(find.text('새 공지가 올라왔어요.'));
    expect(title.style?.fontWeight, FontWeight.w700);
    expect(body.style?.fontWeight, isNot(FontWeight.w700));
    // 한 줄로 이어 붙이지 않는다
    expect(find.textContaining(' · '), findsNothing);

    await tester.tap(find.text('보기'));
    expect(opened, ['open']);
  });

  testWidgets('열 화면이 없으면 [보기]를 두지 않는다', (tester) async {
    await show(
      tester,
      pushSnackBar((title: '[새가족] 새가족 신청', body: null, data: const {}))!,
    );
    expect(find.text('[새가족] 새가족 신청'), findsOneWidget);
    expect(find.text('보기'), findsNothing);
  });

  test('보일 글이 없으면 띄우지 않는다', () {
    expect(pushSnackBar((title: ' ', body: null, data: const {})), isNull);
  });

  testWidgets('작은 폰(360dp)에서 글자를 2배로 키워도 넘치지 않는다', (tester) async {
    await show(
      tester,
      pushSnackBar((
        title: '[회원 공지] 10월 넷째 주 광고 — 가을 수련회 신청 안내와 준비물',
        body: '새 회원 공지가 올라왔어요.',
        data: const {},
      ), onOpen: () {})!,
      textScale: 2,
      size: const Size(360, 740),
    );
    expect(tester.takeException(), isNull);
  });
}
