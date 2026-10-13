import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/core/auth/auth_state.dart';
import 'package:light_mobile/core/theme/app_theme.dart';
import 'package:light_mobile/features/account/login_screen.dart';

import '../../support/fake_server.dart';

FakeServer serverWith(FakeResponse login) => FakeServer((_) async => login);

final ok = respond(200, {
  'data': {'id': '42', 'name': '김도연a', 'role': 'MEMBER'},
});

Future<(AuthState, List<String>)> pumpLogin(
  WidgetTester tester,
  FakeServer server, {
  double textScale = 1,
  Size screen = const Size(411, 914),
  String? signedUpLoginId,
  String? signupReturns,
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
        onDone: () => calls.add('done'),
        onFirstVisit: () => calls.add('welcome'),
        onSignup: () async {
          calls.add('signup');
          return signupReturns;
        },
        openExternal: (url) => calls.add('open:$url'),
        signedUpLoginId: signedUpLoginId,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return (auth, calls);
}

Future<void> fillAndSubmit(
  WidgetTester tester, {
  String id = 'doyeon01',
  String pw = '비밀번호12!',
}) async {
  await tester.enterText(find.byType(TextFormField).at(0), id);
  await tester.enterText(find.byType(TextFormField).at(1), pw);
  await tester.tap(find.widgetWithText(FilledButton, '로그인'));
  await tester.pumpAndSettle();
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

    expect(find.text('아이디 또는 비밀번호가 올바르지 않습니다.'), findsOneWidget);
    expect(auth.user, isNull);
    expect(calls, isEmpty);
  });

  testWidgets('비밀번호를 보였다 숨겼다 한다', (tester) async {
    await pumpLogin(tester, serverWith(ok));
    EditableText password() =>
        tester.widget<EditableText>(find.byType(EditableText).at(1));

    expect(password().obscureText, isTrue);
    await tester.tap(find.byTooltip('비밀번호 보기'));
    await tester.pump();
    expect(password().obscureText, isFalse);
  });

  testWidgets('가입은 앱 안에서 연다 — 웹 주소가 없어도 링크가 있다', (tester) async {
    // 테스트는 WEB_BASE_URL 없이 돈다 (config.dart)
    final (_, calls) = await pumpLogin(tester, serverWith(ok));

    await tester.tap(find.text('▸ 처음이신가요? 회원가입'));
    await tester.tap(find.text('▸ 처음 오시는 분이신가요?'));
    expect(calls, ['signup', 'welcome']);
    // 비밀번호 찾기만 웹이다 — 주소가 없으면 말로 알린다
    expect(find.text('비밀번호 찾기는 LIGHT 웹 홈페이지에서 할 수 있어요.'), findsOneWidget);
  });

  testWidgets('가입을 마치고 돌아오면 아이디를 채우고 비밀번호를 써 보게 한다', (tester) async {
    await pumpLogin(tester, serverWith(ok), signupReturns: 'newbie01');

    await tester.tap(find.text('▸ 처음이신가요? 회원가입'));
    await tester.pumpAndSettle();

    expect(find.text('newbie01'), findsOneWidget);
    expect(find.textContaining('가입이 완료되었어요'), findsOneWidget);
    final password = tester.widget<EditableText>(
      find.byType(EditableText).at(1),
    );
    expect(password.focusNode.hasFocus, isTrue);
  });

  testWidgets('가입 화면에서 곧장 와도 아이디가 채워져 있다', (tester) async {
    await pumpLogin(tester, serverWith(ok), signedUpLoginId: 'newbie01');

    expect(find.text('newbie01'), findsOneWidget);
    expect(find.textContaining('가입이 완료되었어요'), findsOneWidget);
  });

  testWidgets('가입을 그냥 닫고 오면 아무것도 바꾸지 않는다', (tester) async {
    await pumpLogin(tester, serverWith(ok));

    await tester.tap(find.text('▸ 처음이신가요? 회원가입'));
    await tester.pumpAndSettle();

    expect(find.textContaining('가입이 완료되었어요'), findsNothing);
  });

  testWidgets('작은 폰(360dp)에서 글자를 2배로 키워도 넘치지 않는다', (tester) async {
    await pumpLogin(
      tester,
      serverWith(unauthorized()),
      textScale: 2,
      screen: const Size(360, 740),
    );
    await fillAndSubmit(tester);

    expect(tester.takeException(), isNull);
  });
}
