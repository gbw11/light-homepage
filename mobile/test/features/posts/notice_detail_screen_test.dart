import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/core/auth/auth_state.dart';
import 'package:light_mobile/core/auth/auth_user.dart';
import 'package:light_mobile/core/platform/screen_security.dart';
import 'package:light_mobile/core/theme/app_theme.dart';
import 'package:light_mobile/core/ui/watermark.dart';
import 'package:light_mobile/features/posts/notice_detail_screen.dart';
import 'package:light_mobile/features/posts/posts_api.dart';

import '../../support/fake_server.dart';

Map<String, dynamic> detail({
  bool pinned = false,
  List<Object> attachments = const [],
  String category = 'NOTICE_PUBLIC',
}) => {
  'id': '18',
  'category': category,
  'title': '여름 수련회 신청 안내',
  'slug': 'summer-retreat-2026',
  'body': {
    'type': 'doc',
    'content': [
      {
        'type': 'paragraph',
        'content': [
          {'type': 'text', 'text': '8월 20일까지 신청해 주세요.'},
        ],
      },
    ],
  },
  'pinned': pinned,
  'authorName': '김도연a',
  'publishedAt': '2026-08-24T01:00:00Z',
  'updatedAt': '2026-08-24T01:00:00Z',
  'attachments': attachments,
};

const attachment = {
  'id': '7',
  'filename': '신청서.xlsx',
  'contentType': 'application/octet-stream',
  'sizeBytes': 24576,
};

FakeResponse error(int status, String code) => respond(status, {
  'error': {'code': code, 'message': code, 'field': null},
});

Future<List<String>> pumpDetail(
  WidgetTester tester,
  FakeServer server, {
  double textScale = 1,
  Size screen = const Size(411, 914),
  AuthState? auth,
}) async {
  tester.view.physicalSize = screen * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  final opened = <String>[];
  final app = MaterialApp(
    theme: buildAppTheme(),
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(context)
          .copyWith(textScaler: TextScaler.linear(textScale)),
      child: child!,
    ),
    home: NoticeDetailScreen(
      posts: PostsApi(clientFor(server)),
      idOrSlug: '18',
      openExternal: (url) async => opened.add(url),
    ),
  );
  await tester.pumpWidget(
    auth == null ? app : AuthScope(auth: auth, child: app),
  );
  await tester.pumpAndSettle();
  return opened;
}

const me = {
  'id': '42',
  'name': '김도연a',
  'loginId': 'doyeon01',
  'phone': '010-1234-5678',
  'role': 'MEMBER',
};

/// 회의록(또는 [category]) 상세 + 내 정보를 주는 가짜 서버
FakeServer confidentialServer({
  String category = 'MINUTES',
  Map<String, dynamic> user = me,
}) => FakeServer(
  (RequestOptions o) async => switch (o.path) {
    '/posts/18' => respond(200, {'data': detail(category: category)}),
    '/auth/me' => respond(200, {'data': user}),
    // 로그인 응답에는 연락처가 없다 (SPEC_API §2.3)
    '/auth/login' => respond(200, {
      'data': {'id': '42', 'name': '김도연a', 'role': 'MEMBER'},
    }),
    _ => respond(404),
  },
);

/// 캡처 막기 채널에 들어온 호출 (`MainActivity.kt`)
List<String> recordScreenSecurity(WidgetTester tester) {
  final calls = <String>[];
  const channel = MethodChannel('kr.light.app/screen_security');
  tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(channel, (
    call,
  ) async {
    calls.add(call.method);
    return null;
  });
  addTearDown(
    () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      channel,
      null,
    ),
  );
  return calls;
}

void main() {
  testWidgets('제목 · 작성자 · 날짜 · 본문을 보여준다', (tester) async {
    final server = FakeServer((_) async => respond(200, {'data': detail()}));
    await pumpDetail(tester, server);

    expect(server.paths, ['GET /posts/18']);
    expect(find.text('여름 수련회 신청 안내'), findsOneWidget);
    // 작성자와 날짜(시각까지)는 따로 — 분류 딱지는 맨 위에
    expect(find.text('김도연a'), findsOneWidget);
    expect(find.textContaining('2026.08.24'), findsOneWidget);
    // 제목줄의 「공지」와 분류 딱지
    expect(find.text('공지'), findsNWidgets(2));
    expect(find.textContaining('8월 20일까지', findRichText: true), findsOneWidget);
    expect(find.text('📌 고정'), findsNothing);
    expect(find.textContaining('첨부파일'), findsNothing);
  });

  testWidgets('고정 공지는 표시를 단다', (tester) async {
    await pumpDetail(
      tester,
      FakeServer((_) async => respond(200, {'data': detail(pinned: true)})),
    );

    expect(find.text('📌 고정'), findsOneWidget);
  });

  testWidgets('첨부를 누르면 권한이 실린 요청으로 주소를 받아 바깥에서 연다', (tester) async {
    final server = FakeServer(
      (o) async => switch (o.path) {
        '/posts/18' => respond(200, {
          'data': detail(attachments: [attachment]),
        }),
        '/files/7' => respond(302, null, {
          'location': ['https://r2.example.com/7?sig=abc'],
        }),
        _ => respond(404),
      },
    );
    final opened = await pumpDetail(tester, server);

    expect(find.text('신청서.xlsx'), findsOneWidget);
    expect(find.text('24KB'), findsOneWidget);

    await tester.tap(find.text('신청서.xlsx'));
    await tester.pumpAndSettle();

    expect(opened, ['https://r2.example.com/7?sig=abc']);
  });

  testWidgets('첨부를 못 받으면 이유를 알린다', (tester) async {
    final server = FakeServer(
      (o) async => switch (o.path) {
        '/posts/18' => respond(200, {
          'data': detail(attachments: [attachment]),
        }),
        _ => error(404, 'NOT_FOUND'),
      },
    );
    final opened = await pumpDetail(tester, server);

    await tester.tap(find.text('신청서.xlsx'));
    await tester.pumpAndSettle();

    expect(opened, isEmpty);
    expect(find.textContaining('파일을 찾을 수 없어요'), findsOneWidget);
  });

  testWidgets('없는 글(또는 권한 없는 글)은 찾을 수 없다고 말한다', (tester) async {
    await pumpDetail(tester, FakeServer((_) async => error(404, 'NOT_FOUND')));

    expect(find.textContaining('찾을 수 없는 글입니다'), findsOneWidget);
    expect(find.text('다시 시도'), findsNothing);
  });

  testWidgets('회원 글을 비로그인으로 열면 로그인하면 볼 수 있다고 말한다', (tester) async {
    await pumpDetail(
      tester,
      // 리프레시도 401 — 로그인한 적이 없다
      FakeServer((_) async => unauthorized()),
    );

    expect(find.text('로그인하면 볼 수 있어요.'), findsOneWidget);
  });

  testWidgets('그 밖의 실패는 [다시 시도]로 다시 받는다', (tester) async {
    var fail = true;
    final server = FakeServer(
      (RequestOptions o) async => fail
          ? error(500, 'INTERNAL_ERROR')
          : respond(200, {'data': detail()}),
    );
    await pumpDetail(tester, server);
    expect(find.textContaining('불러오지 못했어요'), findsOneWidget);

    fail = false;
    await tester.tap(find.text('다시 시도'));
    await tester.pumpAndSettle();

    expect(find.text('여름 수련회 신청 안내'), findsOneWidget);
  });

  testWidgets('작은 폰(360dp)에서 글자를 2배로 키워도 넘치지 않는다', (tester) async {
    await pumpDetail(
      tester,
      FakeServer(
        (o) async => respond(200, {
          'data': detail(
            pinned: true,
            attachments: [
              {
                ...attachment,
                'filename': '아주아주긴첨부파일이름이들어와도화면밖으로밀려나면안됩니다_최종_진짜최종.xlsx',
              },
            ],
          ),
        }),
      ),
      textScale: 2,
      screen: const Size(360, 740),
    );

    expect(tester.takeException(), isNull);
  });

  group('회의록 · 예산안 — 워터마크 · 캡처 막기 · 복사 막기 (2026-10-19)', () {
    /// [server]로 로그인을 확인한 회원. 확인은 진짜 시계에서 기다려야 끝난다
    /// (가짜 시계 안에서 기다리면 테스트가 멈춘다 — home_screen_test와 같다)
    Future<AuthState> loggedInOf(WidgetTester tester, FakeServer server) async {
      final auth = AuthState(clientFor(server));
      await tester.runAsync(auth.restore);
      addTearDown(auth.dispose);
      return auth;
    }

    for (final category in ['MINUTES', 'BUDGET']) {
      testWidgets('$category 상세에 열람자 워터마크를 깔고 캡처를 막는다', (tester) async {
        final calls = recordScreenSecurity(tester);
        final server = confidentialServer(category: category);
        await pumpDetail(
          tester,
          server,
          auth: await loggedInOf(tester, server),
        );

        final watermark = tester.widget<Watermark>(find.byType(Watermark));
        // 이름 · 연락처 뒷4자리 · 열람 시각 · 문서 번호 (월례회 워터마크와 같은 내용)
        expect(watermark.text, startsWith('김도연a 5678 · '));
        expect(watermark.text, endsWith(' · #18'));
        expect(find.byType(SecureScreen), findsOneWidget);
        expect(calls, ['protect']);
        // 본문 복사도 막는다 — 워터마크는 글자째 가져가는 것을 못 막는다
        expect(find.byType(SelectionArea), findsNothing);
        // 본문은 그대로 읽힌다
        expect(find.text('8월 20일까지 신청해 주세요.'), findsOneWidget);
      });
    }

    testWidgets('화면을 떠나면 캡처 막기를 푼다', (tester) async {
      final calls = recordScreenSecurity(tester);
      final server = confidentialServer();
      await pumpDetail(tester, server, auth: await loggedInOf(tester, server));

      await tester.pumpWidget(const SizedBox());
      expect(calls, ['protect', 'release']);
    });

    testWidgets('공지는 그대로 — 워터마크 · 캡처 막기 없이 복사할 수 있다', (tester) async {
      final calls = recordScreenSecurity(tester);
      final server = confidentialServer(category: 'NOTICE_MEMBER');
      await pumpDetail(tester, server, auth: await loggedInOf(tester, server));

      expect(find.byType(Watermark), findsNothing);
      expect(find.byType(SecureScreen), findsNothing);
      expect(find.byType(SelectionArea), findsOneWidget);
      expect(calls, isEmpty);
    });

    testWidgets('로그인 직후라 연락처를 모르면 받아 와서 뒷4자리를 넣는다', (tester) async {
      final server = confidentialServer();
      final auth = AuthState(clientFor(server));
      addTearDown(auth.dispose);
      await tester.runAsync(
        () => auth.login(loginId: 'doyeon01', password: 'pw'),
      );
      expect(auth.user?.phone, isNull);

      await pumpDetail(tester, server, auth: auth);

      expect(server.paths, contains('GET /auth/me'));
      expect(
        tester.widget<Watermark>(find.byType(Watermark)).text,
        startsWith('김도연a 5678 · '),
      );
    });

    testWidgets('작은 폰(360dp) · 글자 2배에서도 넘치지 않는다', (tester) async {
      final server = confidentialServer();
      await pumpDetail(
        tester,
        server,
        auth: await loggedInOf(tester, server),
        textScale: 2,
        screen: const Size(360, 740),
      );

      expect(tester.takeException(), isNull);
      expect(find.byType(Watermark), findsOneWidget);
    });
  });

  group('워터마크 문구', () {
    final viewedAt = DateTime(2026, 10, 19, 14, 5);

    test('이름 · 연락처 뒷4자리 · 열람 시각 · 문서 번호', () {
      const user = AuthUser(
        id: '42',
        name: '김도연a',
        role: Role.member,
        phone: '010-1234-5678',
      );
      expect(
        watermarkText(user, viewedAt, documentId: '18'),
        '김도연a 5678 · 2026.10.19 14:05 · #18',
      );
    });

    test('연락처 표기가 달라도 숫자 뒷4자리', () {
      const user = AuthUser(
        id: '42',
        name: '김',
        role: Role.member,
        phone: '01098765432',
      );
      expect(watermarkText(user, viewedAt), '김 5432 · 2026.10.19 14:05');
    });

    test('연락처가 없으면 뒷4자리를 지어내지 않고 뺀다', () {
      const user = AuthUser(id: '42', name: '김도연a', role: Role.member);
      expect(watermarkText(user, viewedAt), '김도연a · 2026.10.19 14:05');
    });
  });
}
