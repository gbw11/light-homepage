import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/core/theme/app_theme.dart';
import 'package:light_mobile/features/newcomers/newcomer_form_screen.dart';
import 'package:light_mobile/features/newcomers/newcomers_api.dart';

import '../../support/fake_server.dart';

/// 실서버가 아니라 가짜 서버로만 보낸다 — 실서버에 넣으면 임원 알림에 뜬다
FakeServer okServer() => FakeServer(
  (_) async => respond(201, {
    'data': {'id': '14'},
  }),
);

Map<String, dynamic> sentBody(FakeServer server) =>
    jsonDecode(jsonEncode(server.requests.single.data)) as Map<String, dynamic>;

Future<List<String>> pumpForm(
  WidgetTester tester,
  FakeServer server, {
  double textScale = 1,
  Size screen = const Size(411, 914),
}) async {
  tester.view.physicalSize = screen * 3;
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
      home: NewcomerFormScreen(
        api: NewcomersApi(clientFor(server)),
        onDirections: () => calls.add('directions'),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return calls;
}

Finder field(int index) => find.byType(TextFormField).at(index);

FilledButton submitButton(WidgetTester tester) =>
    tester.widget<FilledButton>(find.widgetWithText(FilledButton, '등록하기'));

/// 화면 목록 — 글 칸(TextField)도 안에 Scrollable을 가져서 바깥 것을 집는다
final page = find.byType(Scrollable).first;

/// [finder]가 화면 안에 다 들어오게 내린 뒤 누른다 — 엠블럼 머리글로 폼이 길어져
/// 아래 칸은 처음에 화면 밖이다
Future<void> tapInView(WidgetTester tester, Finder finder) async {
  await tester.scrollUntilVisible(finder, 200, scrollable: page);
  await tester.drag(page, const Offset(0, -150));
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

Future<void> agree(WidgetTester tester) =>
    tapInView(tester, find.byType(CheckboxListTile));

Future<void> submit(WidgetTester tester) =>
    tapInView(tester, find.widgetWithText(FilledButton, '등록하기'));

void main() {
  testWidgets('동의하기 전에는 [등록하기]가 눌리지 않는다', (tester) async {
    await pumpForm(tester, okServer());

    expect(submitButton(tester).onPressed, isNull);
    await agree(tester);
    expect(submitButton(tester).onPressed, isNotNull);
  });

  testWidgets('이름·연락처가 비면 보내지 않고 칸 아래에 알린다', (tester) async {
    final server = okServer();
    await pumpForm(tester, server);

    await agree(tester);
    await submit(tester);

    expect(server.requests, isEmpty);
    expect(find.text('이름을 입력해주세요.'), findsOneWidget);
    expect(find.text('연락처를 입력해주세요.'), findsOneWidget);
  });

  testWidgets('필수만 채우면 고르지 않은 칸은 빼고 보낸다', (tester) async {
    final server = okServer();
    await pumpForm(tester, server);

    await tester.enterText(field(0), ' 김새가족 ');
    await tester.enterText(field(1), '010-1234-5678');
    await agree(tester);
    await submit(tester);

    expect(server.paths, ['POST /newcomers']);
    expect(sentBody(server), {
      'name': '김새가족',
      'phone': '010-1234-5678',
      'agreed': true,
      'honeypot': '',
    });
  });

  testWidgets('고른 선택지와 남긴 말을 서버 값으로 보낸다', (tester) async {
    final server = okServer();
    await pumpForm(tester, server);

    await tester.enterText(field(0), '김새가족');
    await tester.enterText(field(1), '01012345678');
    await tester.tap(find.text('여'));
    await tester.tap(find.text('선택 안 함').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('20대 후반').last);
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('선택 안 함').last);
    await tester.tap(find.text('선택 안 함').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('지인 소개').last);
    await tester.pumpAndSettle();
    await tester.enterText(field(2), '  친구 소개로 가보려고요 ');
    await agree(tester);
    await submit(tester);

    expect(sentBody(server), {
      'name': '김새가족',
      'phone': '010-1234-5678',
      'gender': 'FEMALE',
      'ageGroup': 'LATE_20S',
      'referrer': 'FRIEND',
      'message': '친구 소개로 가보려고요',
      'agreed': true,
      'honeypot': '',
    });
  });

  testWidgets('등록하면 완료 화면과 [오시는 길 확인하기]를 보여준다', (tester) async {
    final calls = await pumpForm(tester, okServer());

    await tester.enterText(field(0), '김새가족');
    await tester.enterText(field(1), '010-1234-5678');
    await agree(tester);
    await submit(tester);

    expect(find.text('등록됐습니다 🎉'), findsOneWidget);
    await tester.tap(find.text('오시는 길 확인하기'));
    expect(calls, ['directions']);
  });

  testWidgets('서버가 칸을 짚어 거절하면 그 칸 아래에 문구를 단다', (tester) async {
    final server = FakeServer(
      (RequestOptions _) async => respond(400, {
        'error': {
          'code': 'VALIDATION_ERROR',
          'message': '연락처 형식이 올바르지 않습니다.',
          'field': 'phone',
        },
      }),
    );
    await pumpForm(tester, server);

    await tester.enterText(field(0), '김새가족');
    await tester.enterText(field(1), '12');
    await agree(tester);
    await submit(tester);

    expect(find.text('연락처 형식이 올바르지 않습니다.'), findsOneWidget);
    expect(find.text('등록됐습니다 🎉'), findsNothing);
  });

  testWidgets('너무 자주 보내면(429) 잠시 후 다시 하라고 알린다', (tester) async {
    final server = FakeServer(
      (_) async => respond(429, {
        'error': {
          'code': 'RATE_LIMITED',
          'message': 'Too Many Requests',
          'field': null,
        },
      }),
    );
    await pumpForm(tester, server);

    await tester.enterText(field(0), '김새가족');
    await tester.enterText(field(1), '010-1234-5678');
    await agree(tester);
    await submit(tester);

    expect(find.textContaining('잠시 후 다시 시도해 주세요'), findsOneWidget);
    // 다시 누를 수 있다
    expect(submitButton(tester).onPressed, isNotNull);
  });

  testWidgets('작은 폰(360dp)에서 글자를 2배로 키워도 넘치지 않는다', (tester) async {
    await pumpForm(
      tester,
      okServer(),
      textScale: 2,
      screen: const Size(360, 740),
    );
    expect(tester.takeException(), isNull);

    // 입력란도 스크롤 영역이라 화면 목록을 짚어 준다
    await tester.scrollUntilVisible(
      find.text('등록하기'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
