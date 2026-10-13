import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/core/auth/auth_state.dart';
import 'package:light_mobile/core/theme/app_theme.dart';
import 'package:light_mobile/features/account/more_screen.dart';
import 'package:light_mobile/features/account/password_change_screen.dart';
import 'package:light_mobile/features/account/profile_screen.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../support/fake_server.dart';

Map<String, dynamic> me({
  String role = 'MEMBER',
  String? loginId = 'doyeon01',
  String phone = '010-1234-5678',
}) => {
  'id': '42',
  'name': '김도연a',
  'loginId': loginId,
  'phone': phone,
  'role': role,
};

FakeResponse validation(String field, String message) => respond(400, {
  'error': {'code': 'VALIDATION_ERROR', 'message': message, 'field': field},
});

/// [user]가 있으면 로그인한 상태로 시작한다. 나머지 요청은 [handler]가 받는다
Future<(AuthState, FakeServer)> authWith(
  Map<String, dynamic>? user, [
  Future<FakeResponse> Function(RequestOptions o)? handler,
]) async {
  final server = FakeServer(
    (o) async => switch ((o.method, o.path)) {
      ('GET', '/auth/me') =>
        user == null ? unauthorized() : respond(200, {'data': user}),
      ('POST', '/auth/refresh') => unauthorized(),
      _ => handler == null ? respond(204) : await handler(o),
    },
  );
  final auth = AuthState(clientFor(server));
  await auth.restore();
  return (auth, server);
}

/// 위젯 테스트는 가짜 시계 안에서 돈다. 화면을 띄우기 전의 요청(지난 로그인 확인)은
/// 진짜 시계에서 기다려야 끝난다
Future<(AuthState, FakeServer)> start(
  WidgetTester tester,
  Map<String, dynamic>? user, [
  Future<FakeResponse> Function(RequestOptions o)? handler,
]) async => (await tester.runAsync(() => authWith(user, handler)))!;

Future<List<String>> pump(
  WidgetTester tester,
  AuthState auth,
  Widget Function(List<String> calls) screen, {
  double textScale = 1,
  Size size = const Size(411, 914),
}) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  addTearDown(auth.dispose);

  final calls = <String>[];
  await tester.pumpWidget(
    AuthScope(
      auth: auth,
      child: MaterialApp(
        theme: buildAppTheme(),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context)
              .copyWith(textScaler: TextScaler.linear(textScale)),
          child: child!,
        ),
        home: screen(calls),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return calls;
}

MoreScreen more(List<String> calls) => MoreScreen(
  onLogin: () => calls.add('login'),
  onSignup: () => calls.add('signup'),
  onProfile: () => calls.add('profile'),
  onPasswordChange: () => calls.add('password'),
  onContact: () => calls.add('contact'),
  openExternal: (url) => calls.add('open:$url'),
);

void main() {
  setUp(
    () => PackageInfo.setMockInitialValues(
      appName: 'LIGHT',
      packageName: 'kr.light.app',
      version: '1.0.0',
      buildNumber: '1',
      buildSignature: '',
    ),
  );

  group('더보기', () {
    testWidgets('비로그인이면 [로그인]과 [회원가입]을 둔다 — 가입은 앱 안에서', (tester) async {
      final (auth, _) = await start(tester, null);
      final calls = await pump(tester, auth, more);

      await tester.tap(find.widgetWithText(FilledButton, '로그인'));
      await tester.tap(find.text('회원가입'));
      expect(calls, ['login', 'signup']);
      expect(find.text('로그아웃'), findsNothing);
    });

    testWidgets('로그인하면 이름 · 역할과 계정 메뉴를 보인다', (tester) async {
      final (auth, _) = await start(tester, me());
      final calls = await pump(tester, auth, more);

      expect(find.text('김도연a'), findsOneWidget);
      expect(find.text('일반 회원'), findsOneWidget);
      await tester.tap(find.text('내 정보'));
      await tester.tap(find.text('비밀번호 변경'));
      await tester.tap(find.text('문의하기'));
      expect(calls, ['profile', 'password', 'contact']);
    });

    testWidgets('카카오로 가입한 사람에게는 비밀번호 변경을 숨긴다', (tester) async {
      final (auth, _) = await start(tester, me(loginId: null));
      await pump(tester, auth, more);

      expect(find.text('내 정보'), findsOneWidget);
      expect(find.text('비밀번호 변경'), findsNothing);
    });

    testWidgets('로그아웃은 한 번 더 묻고, 하면 비로그인 화면이 된다', (tester) async {
      final (auth, server) = await start(tester, me());
      await pump(tester, auth, more);

      await tester.tap(find.text('로그아웃'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('취소'));
      await tester.pumpAndSettle();
      expect(auth.isLoggedIn, isTrue);

      await tester.tap(find.text('로그아웃'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(TextButton, '로그아웃'));
      await tester.pumpAndSettle();

      expect(server.paths, contains('POST /auth/logout'));
      expect(auth.isLoggedIn, isFalse);
      expect(find.text('로그아웃했어요.'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, '로그인'), findsOneWidget);
    });

    testWidgets('앱 버전을 보인다', (tester) async {
      final (auth, _) = await start(tester, null);
      await pump(tester, auth, more);

      expect(find.text('1.0.0 (1)'), findsOneWidget);
    });

    testWidgets('임원이어도 웹 주소가 없으면 관리 링크를 두지 않는다', (tester) async {
      // 테스트는 WEB_BASE_URL 없이 돈다 — 열리지 않는 링크를 두지 않는다
      final (auth, _) = await start(tester, me(role: 'LEADER'));
      await pump(tester, auth, more);

      expect(find.text('임원'), findsOneWidget);
      expect(find.text('관리 화면 (웹)'), findsNothing);
    });

    testWidgets('작은 폰(360dp)에서 글자를 2배로 키워도 넘치지 않는다', (tester) async {
      final (auth, _) = await start(tester, me());
      await pump(tester, auth, more, textScale: 2, size: const Size(360, 740));

      expect(tester.takeException(), isNull);
    });
  });

  group('내 정보', () {
    ProfileScreen Function(List<String>) profile(AuthState auth) =>
        (calls) => ProfileScreen(
          auth: auth,
          onLogin: () => calls.add('login'),
          openExternal: (url) => calls.add('open:$url'),
        );

    testWidgets('이름 · 아이디 · 연락처 · 권한을 보인다', (tester) async {
      final (auth, _) = await start(tester, me());
      await pump(tester, auth, profile(auth));

      expect(find.text('김도연a'), findsOneWidget);
      expect(find.text('doyeon01'), findsOneWidget);
      expect(find.text('010-1234-5678'), findsOneWidget);
      expect(find.text('일반 회원'), findsOneWidget);
      expect(find.textContaining('회원 탈퇴는'), findsOneWidget);
    });

    testWidgets('연락처는 형식이 맞아야 보낸다', (tester) async {
      final (auth, server) = await start(tester, me());
      await pump(tester, auth, profile(auth));

      await tester.tap(find.text('수정'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '01099998888');
      await tester.tap(find.text('저장'));
      await tester.pumpAndSettle();

      expect(find.text('010-0000-0000 형식으로 입력해주세요.'), findsOneWidget);
      expect(server.paths, isNot(contains('PATCH /auth/me')));
    });

    testWidgets('연락처를 바꾸면 그 자리에서 새 값이 보인다', (tester) async {
      final (auth, server) = await start(
        tester,
        me(),
        (o) async => respond(200, {'data': me(phone: '010-9999-8888')}),
      );
      await pump(tester, auth, profile(auth));

      await tester.tap(find.text('수정'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '010-9999-8888');
      await tester.tap(find.text('저장'));
      await tester.pumpAndSettle();

      expect(server.requests.last.data, {'phone': '010-9999-8888'});
      expect(find.text('010-9999-8888'), findsOneWidget);
      expect(find.text('연락처를 바꿨어요.'), findsOneWidget);
    });

    testWidgets('취소하면 원래 값으로 돌아간다', (tester) async {
      final (auth, _) = await start(tester, me());
      await pump(tester, auth, profile(auth));

      await tester.tap(find.text('수정'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '010-0000-0000');
      await tester.tap(find.text('취소'));
      await tester.pumpAndSettle();

      expect(find.text('010-1234-5678'), findsOneWidget);
    });

    testWidgets('로그인해 있지 않으면 로그인 안내를 둔다', (tester) async {
      final (auth, _) = await start(tester, null);
      final calls = await pump(tester, auth, profile(auth));

      await tester.tap(find.widgetWithText(FilledButton, '로그인'));
      expect(calls, ['login']);
    });
  });

  group('비밀번호 변경', () {
    PasswordChangeScreen Function(List<String>) screen(AuthState auth) =>
        (calls) =>
            PasswordChangeScreen(auth: auth, onDone: () => calls.add('done'));

    Future<void> fill(
      WidgetTester tester, {
      String current = '옛비밀번호12!',
      String next = 'newPassword1!',
      String? confirm,
    }) async {
      final fields = find.byType(TextFormField);
      await tester.enterText(fields.at(0), current);
      await tester.enterText(fields.at(1), next);
      await tester.enterText(fields.at(2), confirm ?? next);
      await tester.tap(find.widgetWithText(FilledButton, '비밀번호 변경'));
      await tester.pumpAndSettle();
    }

    String fieldText(WidgetTester tester, int i) => tester
        .widget<EditableText>(find.byType(EditableText).at(i))
        .controller
        .text;

    testWidgets('바꾸면 알리고 닫는다', (tester) async {
      final (auth, server) = await start(tester, me());
      final calls = await pump(tester, auth, screen(auth));

      await fill(tester);

      expect(server.requests.last.path, '/auth/password/change');
      expect(server.requests.last.data, {
        'currentPassword': '옛비밀번호12!',
        'newPassword': 'newPassword1!',
      });
      expect(calls, ['done']);
      expect(find.textContaining('비밀번호를 바꿨어요'), findsOneWidget);
    });

    testWidgets('새 비밀번호 규칙과 확인을 보내기 전에 본다', (tester) async {
      final (auth, server) = await start(tester, me());
      await pump(tester, auth, screen(auth));

      await fill(tester, next: 'short', confirm: 'short');
      expect(find.text('새 비밀번호는 8자 이상이어야 합니다.'), findsOneWidget);

      await fill(tester, next: '가' * 25, confirm: '가' * 25);
      expect(find.textContaining('한글은 24자까지'), findsOneWidget);

      await fill(tester, next: 'newPassword1!', confirm: 'different1!');
      expect(find.text('새 비밀번호가 일치하지 않습니다.'), findsOneWidget);

      expect(server.paths, isNot(contains('POST /auth/password/change')));
    });

    testWidgets('현재 비밀번호가 틀리면 세 칸을 모두 비우고 현재 칸으로 돌아간다', (tester) async {
      final (auth, _) = await start(
        tester,
        me(),
        (_) async => validation('password', '비밀번호가 올바르지 않습니다.'),
      );
      final calls = await pump(tester, auth, screen(auth));

      await fill(tester);

      expect(find.text('현재 비밀번호가 올바르지 않습니다.'), findsOneWidget);
      for (var i = 0; i < 3; i++) {
        expect(fieldText(tester, i), isEmpty);
      }
      final current = tester.widget<EditableText>(
        find.byType(EditableText).at(0),
      );
      expect(current.focusNode.hasFocus, isTrue);
      expect(calls, isEmpty);
      // 로그인은 그대로다 — 401이 아니라 400이다
      expect(auth.isLoggedIn, isTrue);
    });

    testWidgets('작은 폰(360dp)에서 글자를 2배로 키워도 넘치지 않는다', (tester) async {
      final (auth, _) = await start(
        tester,
        me(),
        (_) async => validation('password', 'x'),
      );
      await pump(
        tester,
        auth,
        screen(auth),
        textScale: 2,
        size: const Size(360, 740),
      );
      await fill(tester);

      expect(tester.takeException(), isNull);
    });
  });
}
