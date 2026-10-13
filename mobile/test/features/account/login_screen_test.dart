import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/core/auth/auth_api.dart';
import 'package:light_mobile/core/auth/auth_state.dart';
import 'package:light_mobile/core/theme/app_theme.dart';
import 'package:light_mobile/features/account/auth_form.dart';
import 'package:light_mobile/features/account/login_screen.dart';

import '../../support/fake_server.dart';

FakeServer serverWith(FakeResponse login) => FakeServer(
  (RequestOptions o) async => switch (o.path) {
    '/auth/verify-roster' => respond(200, {
      'data': {'registrationToken': 't', 'name': '김도연a', 'expiresIn': 300},
    }),
    '/auth/register' => respond(201, {
      'data': {'id': '42', 'name': '김도연a', 'role': 'MEMBER'},
    }),
    _ => login,
  },
);

final ok = respond(200, {
  'data': {'id': '42', 'name': '김도연a', 'role': 'MEMBER'},
});

Future<(AuthState, List<String>)> pumpLogin(
  WidgetTester tester,
  FakeServer server, {
  double textScale = 1,
  Size screen = const Size(411, 914),
  AuthMode mode = AuthMode.login,
}) async {
  tester.view.physicalSize = screen * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  final auth = AuthState(clientFor(server));
  addTearDown(auth.dispose);
  final calls = <String>[];
  await tester.pumpWidget(
    MaterialApp(
      theme: buildAppTheme(),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context)
            .copyWith(textScaler: TextScaler.linear(textScale)),
        child: child!,
      ),
      home: LoginScreen(
        auth: auth,
        signupApi: AuthApi(clientFor(server)),
        initialMode: mode,
        onDone: () => calls.add('done'),
        onFirstVisit: () => calls.add('welcome'),
        openExternal: (url) => calls.add('open:$url'),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return (auth, calls);
}

/// 화면 목록 — 글 칸(TextField)도 안에 Scrollable을 가져서 바깥 것을 집는다
final page = find.byType(Scrollable).first;

/// 이름표가 [label]인 입력칸
Finder field(String label) => find.descendant(
  of: find.widgetWithText(AuthField, label),
  matching: find.byType(TextFormField),
);

EditableText editable(WidgetTester tester, String label) =>
    tester.widget<EditableText>(
      find.descendant(of: field(label), matching: find.byType(EditableText)),
    );

Future<void> enter(WidgetTester tester, String label, String text) async {
  await tester.scrollUntilVisible(field(label), 100, scrollable: page);
  await tester.enterText(field(label), text);
}

Future<void> press(WidgetTester tester, String label) async {
  final button = find.widgetWithText(FilledButton, label);
  await tester.scrollUntilVisible(button, 100, scrollable: page);
  await tester.pumpAndSettle();
  await tester.tap(button);
  await tester.pumpAndSettle();
}

Future<void> fillAndSubmit(
  WidgetTester tester, {
  String id = 'doyeon01',
  String pw = '비밀번호12!',
}) async {
  await enter(tester, '아이디', id);
  await enter(tester, '비밀번호', pw);
  await press(tester, '로그인하기');
}

void main() {
  testWidgets('로그인하면 상태가 바뀌고 연 화면으로 돌아간다', (tester) async {
    final server = serverWith(ok);
    final (auth, calls) = await pumpLogin(tester, server);

    await fillAndSubmit(tester, id: '  doyeon01 ');

    expect(server.paths, ['POST /auth/login']);
    expect(server.requests.single.data, {
      'loginId': 'doyeon01',
      'password': '비밀번호12!',
    });
    expect(auth.user?.name, '김도연a');
    expect(calls, ['done']);
  });

  testWidgets('비어 있으면 보내지 않고 칸 아래에 알린다', (tester) async {
    final server = serverWith(ok);
    await pumpLogin(tester, server);

    await fillAndSubmit(tester, id: '', pw: '');

    expect(server.requests, isEmpty);
    expect(find.text('아이디를 입력해주세요.'), findsOneWidget);
    expect(find.text('비밀번호를 입력해주세요.'), findsOneWidget);
  });

  testWidgets('틀리면(잠금도 같은 응답) 같은 문구 하나로 알린다', (tester) async {
    final (auth, calls) = await pumpLogin(tester, serverWith(unauthorized()));

    await fillAndSubmit(tester);

    expect(find.textContaining('아이디 또는 비밀번호가 올바르지 않습니다.'), findsOneWidget);
    expect(auth.user, isNull);
    expect(calls, isEmpty);
  });

  testWidgets('비밀번호를 보였다 숨겼다 한다', (tester) async {
    await pumpLogin(tester, serverWith(ok));

    expect(editable(tester, '비밀번호').obscureText, isTrue);
    await tester.tap(find.byTooltip('비밀번호 보기'));
    await tester.pump();
    expect(editable(tester, '비밀번호').obscureText, isFalse);
  });

  testWidgets('웹 주소가 없으면 비밀번호 찾기는 말로 알리고, 처음 오신 분은 안내로 보낸다', (tester) async {
    // 테스트는 WEB_BASE_URL 없이 돈다 (config.dart)
    final (_, calls) = await pumpLogin(tester, serverWith(ok));

    expect(find.text('비밀번호 찾기'), findsNothing);
    expect(find.text('비밀번호 찾기는 LIGHT 웹 홈페이지에서 할 수 있어요.'), findsOneWidget);
    final firstVisit = find.text('처음 오시는 분이신가요? ›');
    await tester.scrollUntilVisible(firstVisit, 100, scrollable: page);
    await tester.tap(firstVisit);
    expect(calls, ['welcome']);
  });

  testWidgets('위쪽 칸으로 회원가입과 로그인을 오간다', (tester) async {
    await pumpLogin(tester, serverWith(ok));

    await tester.tap(find.text('회원가입'));
    await tester.pumpAndSettle();
    expect(find.text('1/2  본인 확인'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, '로그인하기'), findsNothing);

    await tester.tap(find.text('로그인'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(FilledButton, '로그인하기'), findsOneWidget);
  });

  testWidgets('회원가입 칸으로 열 수 있다 (마이페이지의 [회원가입])', (tester) async {
    await pumpLogin(tester, serverWith(ok), mode: AuthMode.signup);

    expect(find.text('1/2  본인 확인'), findsOneWidget);
  });

  testWidgets('가입을 마치면 로그인 칸으로 와서 아이디를 채우고 비밀번호를 써 보게 한다', (tester) async {
    await pumpLogin(tester, serverWith(ok), mode: AuthMode.signup);

    await enter(tester, '이름', '김도연a');
    await enter(tester, '생년월일', '20010314');
    await enter(tester, '전화번호', '01012345678');
    await press(tester, '확인하기');
    await enter(tester, '아이디', 'newbie01');
    await enter(tester, '비밀번호', '비밀번호1234!');
    await enter(tester, '비밀번호 확인', '비밀번호1234!');
    await press(tester, '가입하기');
    await press(tester, '로그인하기'); // 완료 화면의 버튼

    expect(find.textContaining('가입이 완료되었어요'), findsOneWidget);
    expect(editable(tester, '아이디').controller.text, 'newbie01');
    expect(editable(tester, '비밀번호').focusNode.hasFocus, isTrue);
  });

  for (final mode in AuthMode.values) {
    testWidgets('작은 폰(360dp)에서 글자를 2배로 키워도 넘치지 않는다 — ${mode.name}', (
      tester,
    ) async {
      await pumpLogin(
        tester,
        serverWith(unauthorized()),
        textScale: 2,
        screen: const Size(360, 740),
        mode: mode,
      );
      if (mode == AuthMode.login) await fillAndSubmit(tester);

      expect(tester.takeException(), isNull);
    });
  }
}
