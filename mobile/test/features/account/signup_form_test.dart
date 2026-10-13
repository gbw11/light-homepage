import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/core/auth/auth_api.dart';
import 'package:light_mobile/core/format/dashed_digits_formatter.dart';
import 'package:light_mobile/core/theme/app_theme.dart';
import 'package:light_mobile/core/ui/form_card.dart';
import 'package:light_mobile/features/account/signup_form.dart';

import '../../support/fake_server.dart';

final verified = respond(200, {
  'data': {'registrationToken': 'tok-1', 'name': '김도연a', 'expiresIn': 300},
});

final created = respond(201, {
  'data': {'id': '42', 'name': '김도연a', 'role': 'MEMBER'},
});

FakeResponse error(int status, String code, String message, {String? field}) =>
    respond(status, {
      'error': {'code': code, 'message': message, 'field': field},
    });

FakeServer serverWith({FakeResponse? verify, FakeResponse? register}) =>
    FakeServer(
      (RequestOptions o) async => switch (o.path) {
        '/auth/verify-roster' => verify ?? verified,
        '/auth/register' => register ?? created,
        _ => respond(404),
      },
    );

/// 가입을 띄우고, 가입이 로그인으로 보낸 아이디를 모은다.
/// 로그인 화면처럼 스크롤 목록 안에 둔다
Future<List<String>> pumpSignup(
  WidgetTester tester,
  FakeServer server, {
  double textScale = 1,
  Size screen = const Size(411, 914),
}) async {
  tester.view.physicalSize = screen * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  final logins = <String>[];
  await tester.pumpWidget(
    MaterialApp(
      theme: buildAppTheme(),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context)
            .copyWith(textScaler: TextScaler.linear(textScale)),
        child: child!,
      ),
      home: Scaffold(
        body: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            SignupForm(auth: AuthApi(clientFor(server)), onLogin: logins.add),
          ],
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return logins;
}

/// 이름표가 [label]인 입력칸
Finder field(String label) => find.descendant(
  of: find.widgetWithText(CardField, label),
  matching: find.byType(TextFormField),
);

/// 칸에 들어 있는 값 — 칸의 hint(예: 2001-03-14)와 헷갈리지 않게 입력값만 본다
String valueOf(WidgetTester tester, String label) => tester
    .widget<EditableText>(
      find.descendant(of: field(label), matching: find.byType(EditableText)),
    )
    .controller
    .text;

/// 화면 목록 — 글 칸(TextField)도 안에 Scrollable을 가져서 바깥 것을 집는다
final page = find.byType(Scrollable).first;

/// 큰 글씨에서는 아래 칸이 화면 밖이라 아직 만들어지지 않았다 — 내려서 찾는다
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

Future<void> verify(
  WidgetTester tester, {
  String name = ' 김도연a ',
  String birth = '20010314',
  String phone = '01012345678',
}) async {
  await enter(tester, '이름', name);
  await enter(tester, '생년월일', birth);
  await enter(tester, '전화번호', phone);
  await press(tester, '확인하기');
}

Future<void> register(
  WidgetTester tester, {
  String id = 'newbie01',
  String pw = '비밀번호1234!',
  String? confirm,
}) async {
  await enter(tester, '아이디', id);
  await enter(tester, '비밀번호', pw);
  await enter(tester, '비밀번호 확인', confirm ?? pw);
  await press(tester, '가입하기');
}

void main() {
  group('1단계 — 본인 확인', () {
    testWidgets('숫자만 눌러도 모양을 갖춰 명단 확인을 보내고, 2단계로 간다', (tester) async {
      final server = serverWith();
      await pumpSignup(tester, server);

      await verify(tester);

      expect(server.paths, ['POST /auth/verify-roster']);
      expect(server.requests.single.data, {
        'name': '김도연a',
        'birthDate': '2001-03-14',
        'phone': '010-1234-5678',
      });
      expect(find.text('김도연a님, 확인되었습니다.'), findsOneWidget);
      expect(find.textContaining('5:00 안에'), findsOneWidget);
    });

    testWidgets('칸 모양이 틀리면 보내지 않는다 — 없는 날짜도 걸러낸다', (tester) async {
      final server = serverWith();
      await pumpSignup(tester, server);

      await verify(tester, name: ' ', birth: '20010230', phone: '0101234');

      expect(server.requests, isEmpty);
      expect(find.text('이름을 입력해 주세요.'), findsOneWidget);
      expect(find.text('생년월일을 2001-03-14처럼 입력해 주세요.'), findsOneWidget);
      expect(find.text('전화번호를 010-1234-5678처럼 입력해 주세요.'), findsOneWidget);
    });

    testWidgets('명단과 다르면 어느 칸인지 말하지 않고 문구 하나로 알린다', (tester) async {
      await pumpSignup(
        tester,
        serverWith(verify: error(401, 'UNAUTHORIZED', '명단에서 확인되지 않습니다.')),
      );

      await verify(tester);

      expect(find.textContaining('명단에서 확인되지 않습니다.'), findsOneWidget);
      // 칸 아래 오류는 없다 — 칸마다 짚으면 명단 정보를 캐낼 수 있다
      expect(find.textContaining('입력해 주세요.'), findsNothing);
      expect(find.widgetWithText(FilledButton, '확인하기'), findsOneWidget);
    });

    testWidgets('동명이인이면 임원에게 문의하라는 서버 문구를 그대로 보인다', (tester) async {
      await pumpSignup(
        tester,
        serverWith(
          verify: error(
            400,
            'VALIDATION_ERROR',
            '동명이인이 확인되었습니다. 임원에게 문의해 주세요.',
            field: 'name',
          ),
        ),
      );

      await verify(tester);

      expect(find.textContaining('임원에게 문의해 주세요.'), findsOneWidget);
    });
  });

  group('2단계 — 계정 만들기', () {
    testWidgets('가입하면 완료 화면, [로그인하기]는 만든 아이디를 들고 간다', (tester) async {
      final server = serverWith();
      final logins = await pumpSignup(tester, server);
      await verify(tester);

      await register(tester, id: ' newbie01 ');

      expect(server.requests.last.data, {
        'registrationToken': 'tok-1',
        'loginId': 'newbie01',
        'password': '비밀번호1234!',
      });
      expect(find.text('가입이 완료되었습니다'), findsOneWidget);
      await tester.tap(find.widgetWithText(FilledButton, '로그인하기'));
      expect(logins, ['newbie01']);
    });

    testWidgets('비밀번호가 생년월일 · 전화번호와 같으면 보내기 전에 막는다', (tester) async {
      final server = serverWith();
      await pumpSignup(tester, server);
      await verify(tester);

      await register(tester, pw: '20010314');
      expect(find.text('생년월일 · 전화번호와 같은 비밀번호는 쓸 수 없습니다.'), findsOneWidget);

      await register(tester, pw: '010-1234-5678');
      expect(find.text('생년월일 · 전화번호와 같은 비밀번호는 쓸 수 없습니다.'), findsOneWidget);

      expect(server.paths, ['POST /auth/verify-roster']);
    });

    testWidgets('아이디 모양 · 비밀번호 길이 · 확인 불일치를 칸 아래에 알린다', (tester) async {
      final server = serverWith();
      await pumpSignup(tester, server);
      await verify(tester);

      await register(tester, id: 'AB', pw: 'short', confirm: 'other');

      expect(find.text('아이디는 영문 소문자 · 숫자 · 밑줄(_) 4~30자입니다.'), findsOneWidget);
      expect(find.text('비밀번호는 8자 이상이어야 합니다.'), findsOneWidget);
      expect(find.text('비밀번호가 일치하지 않습니다.'), findsOneWidget);
      expect(server.paths, ['POST /auth/verify-roster']);
    });

    testWidgets('이미 있는 아이디면 아이디 칸 아래에 알린다', (tester) async {
      await pumpSignup(
        tester,
        serverWith(
          register: error(
            409,
            'DUPLICATE',
            '이미 사용 중인 아이디입니다.',
            field: 'loginId',
          ),
        ),
      );
      await verify(tester);

      await register(tester);

      expect(find.text('이미 사용 중인 아이디입니다.'), findsOneWidget);
      expect(find.text('김도연a님, 확인되었습니다.'), findsOneWidget);
    });

    testWidgets('토큰이 만료(401)되면 만료 화면 — 다시 확인하면 입력이 남아 있다', (tester) async {
      await pumpSignup(
        tester,
        serverWith(register: error(401, 'UNAUTHORIZED', '만료')),
      );
      await verify(tester);

      await register(tester);
      expect(find.text('시간이 지났습니다'), findsOneWidget);

      await tester.tap(find.widgetWithText(FilledButton, '다시 확인하기'));
      await tester.pumpAndSettle();
      expect(valueOf(tester, '생년월일'), '2001-03-14');
      expect(valueOf(tester, '전화번호'), '010-1234-5678');
    });

    testWidgets('5분이 지나면 저절로 만료 화면으로 간다', (tester) async {
      await pumpSignup(tester, serverWith());
      await verify(tester);

      await tester.pump(const Duration(seconds: 299));
      expect(find.textContaining('0:01 안에'), findsOneWidget);

      await tester.pump(const Duration(seconds: 1));
      await tester.pumpAndSettle();
      expect(find.text('시간이 지났습니다'), findsOneWidget);
    });

    testWidgets('뒤로가기는 화면을 닫지 않고 1단계로 돌아간다', (tester) async {
      await pumpSignup(tester, serverWith());
      await verify(tester);

      await tester.state<NavigatorState>(find.byType(Navigator)).maybePop();
      await tester.pumpAndSettle();

      expect(find.widgetWithText(FilledButton, '확인하기'), findsOneWidget);
      expect(valueOf(tester, '생년월일'), '2001-03-14');
    });
  });

  testWidgets('작은 폰(360dp)에서 글자를 2배로 키워도 넘치지 않는다', (tester) async {
    await pumpSignup(
      tester,
      serverWith(verify: error(401, 'UNAUTHORIZED', 'x')),
      textScale: 2,
      screen: const Size(360, 740),
    );
    await verify(tester);
    expect(tester.takeException(), isNull);
  });

  testWidgets('작은 폰 · 큰 글씨 — 2단계도 넘치지 않는다', (tester) async {
    await pumpSignup(
      tester,
      serverWith(),
      textScale: 2,
      screen: const Size(360, 740),
    );
    await verify(tester);
    await register(tester, id: 'AB', pw: 'short');
    expect(tester.takeException(), isNull);
  });

  group('숫자 자리 맞춤', () {
    String type(TextInputFormatter f, String text, {String old = ''}) => f
        .formatEditUpdate(
          TextEditingValue(text: old),
          TextEditingValue(text: text),
        )
        .text;

    test('생년월일 · 전화번호 모양으로 `-`를 넣는다', () {
      const birth = DashedDigitsFormatter.birthDate();
      const phone = DashedDigitsFormatter.phone();
      expect(type(birth, '2001'), '2001');
      expect(type(birth, '20010'), '2001-0');
      expect(type(birth, '20010314'), '2001-03-14');
      expect(type(phone, '01012345678'), '010-1234-5678');
    });

    test('붙여넣은 `-` · 띄어쓰기는 거르고, 넘치는 숫자는 버린다', () {
      const phone = DashedDigitsFormatter.phone();
      expect(type(phone, '010 1234-5678'), '010-1234-5678');
      expect(type(phone, '0101234567899'), '010-1234-5678');
    });

    test('`-` 바로 뒤에서 지우면 그 앞 숫자까지 지운다', () {
      const birth = DashedDigitsFormatter.birthDate();
      expect(type(birth, '2001-', old: '2001-0'), '2001');
      expect(type(birth, '200103', old: '2001-03'), '2001-0');
    });

    test('없는 날짜 · 미래 날짜는 생년월일이 아니다', () {
      expect(isValidBirthDate('2001-03-14'), isTrue);
      expect(isValidBirthDate('2000-02-29'), isTrue);
      expect(isValidBirthDate('2001-02-29'), isFalse);
      expect(isValidBirthDate('2001-13-01'), isFalse);
      expect(isValidBirthDate('2999-01-01'), isFalse);
      expect(isValidBirthDate('20010314'), isFalse);
    });
  });
}
