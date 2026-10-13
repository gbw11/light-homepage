import 'package:dio/dio.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/core/auth/auth_state.dart';
import 'package:light_mobile/core/format/date_format.dart';
import 'package:light_mobile/core/theme/app_theme.dart';
import 'package:light_mobile/features/bulletins/bulletin_viewer_screen.dart';
import 'package:light_mobile/features/bulletins/bulletins_api.dart';
import 'package:light_mobile/features/meetings/meetings_api.dart';
import 'package:light_mobile/features/resources/resources_screen.dart';

import '../../support/fake_server.dart';

Map<String, dynamic> me(String role) => {
  'id': '42',
  'name': '김도연a',
  'loginId': 'doyeon01',
  'phone': '010-1234-5678',
  'role': role,
};

Map<String, dynamic> meeting(
  String status, {
  String until = '2026-10-09T14:59:00Z',
}) => {
  'id': '3',
  'title': '10월 월례회',
  'meetingDate': '2026-10-05',
  'pageCount': 4,
  'viewableFrom': '2026-10-05T11:00:00Z',
  'viewableUntil': until,
  'status': status,
};

Map<String, dynamic> summary(String id, String date, {int pages = 2}) => {
  'id': id,
  'serviceDate': date,
  'pageCount': pages,
  'thumbUrl': 'https://r2.example.com/b/$id/1.webp?sig=x',
};

Map<String, dynamic> detail(String id, int pages) => {
  'id': id,
  'serviceDate': '2026-10-11',
  'pages': [
    for (var i = 1; i <= pages; i++)
      {
        'pageNo': i,
        'url': 'https://r2.example.com/b/$id/$i.webp?sig=x',
        'width': null,
        'height': null,
      },
  ],
};

FakeResponse page(List<Object> items, {bool hasNext = false, int page = 0}) =>
    respond(200, {
      'data': {'items': items, 'page': page, 'size': 20, 'hasNext': hasNext},
    });

/// 지난 로그인 확인은 진짜 시계에서 기다려야 끝난다 (위젯 테스트는 가짜 시계)
Future<AuthState> authAs(
  WidgetTester tester,
  Map<String, dynamic>? user,
) async {
  final server = FakeServer(
    (o) async => switch (o.path) {
      '/auth/me' when user != null => respond(200, {'data': user}),
      _ => unauthorized(),
    },
  );
  final auth = AuthState(clientFor(server));
  await tester.runAsync(auth.restore);
  addTearDown(auth.dispose);
  return auth;
}

Future<void> pump(
  WidgetTester tester,
  Widget screen, {
  AuthState? auth,
  double textScale = 1,
  Size size = const Size(411, 914),
}) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final app = MaterialApp(
    theme: buildAppTheme(),
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(context)
          .copyWith(textScaler: TextScaler.linear(textScale)),
      child: child!,
    ),
    home: screen,
  );
  await tester.pumpWidget(
    auth == null ? app : AuthScope(auth: auth, child: app),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('자료 탭', () {
    ResourcesScreen screen(FakeServer server, List<String> calls) =>
        ResourcesScreen(
          meetings: MeetingsApi(clientFor(server)),
          onLogin: () => calls.add('login'),
          onOpen: (r) => calls.add(r.name),
          openExternal: (url) => calls.add('open:$url'),
        );

    FakeServer meetingsWith(List<Object> items) =>
        FakeServer((_) async => page(items));

    testWidgets('비로그인은 무엇이 있는지만 알리고 로그인으로 보낸다', (tester) async {
      final auth = await authAs(tester, null);
      final calls = <String>[];
      final server = meetingsWith([]);
      await pump(tester, screen(server, calls), auth: auth);

      expect(find.textContaining('회원 전용 자료예요'), findsOneWidget);
      expect(find.text('주보'), findsNothing);
      // 비로그인에게 회원 API를 부르지 않는다 (서버는 401)
      expect(server.requests, isEmpty);

      await tester.tap(find.widgetWithText(FilledButton, '로그인'));
      expect(calls, ['login']);
    });

    testWidgets('회원은 카드 4개, 누르면 그 자료로 간다', (tester) async {
      final auth = await authAs(tester, me('MEMBER'));
      final calls = <String>[];
      await pump(tester, screen(meetingsWith([]), calls), auth: auth);

      for (final title in ['주보', '사진첩', '월례회 자료', '회의록']) {
        expect(find.text(title), findsOneWidget);
      }
      expect(find.text('예산안'), findsNothing);

      await tester.tap(find.text('주보'));
      await tester.tap(find.text('사진첩'));
      expect(calls, ['bulletins', 'photos']);
    });

    testWidgets('임원 이상은 예산안 카드가 더 있다', (tester) async {
      final auth = await authAs(tester, me('LEADER'));
      await pump(tester, screen(meetingsWith([]), []), auth: auth);

      expect(find.text('예산안'), findsOneWidget);
    });

    testWidgets('열람 기간인 월례회가 있으면 카드에 마감을 단다', (tester) async {
      final auth = await authAs(tester, me('MEMBER'));
      await pump(
        tester,
        screen(meetingsWith([meeting('OPEN')]), []),
        auth: auth,
      );

      final until = formatMonthDayTime(DateTime.utc(2026, 10, 9, 14, 59));
      expect(find.text('열람 중 · ~$until'), findsOneWidget);
    });

    testWidgets('열람 기간이 아니면 마감 표시가 없다', (tester) async {
      final auth = await authAs(tester, me('MEMBER'));
      await pump(
        tester,
        screen(meetingsWith([meeting('CLOSED'), meeting('SCHEDULED')]), []),
        auth: auth,
      );

      expect(find.textContaining('열람 중'), findsNothing);
    });

    testWidgets('작은 폰(360dp)에서 글자를 2배로 키워도 넘치지 않는다', (tester) async {
      final auth = await authAs(tester, me('PASTOR'));
      await pump(
        tester,
        screen(meetingsWith([meeting('OPEN')]), []),
        auth: auth,
        textScale: 2,
        size: const Size(360, 740),
      );

      expect(tester.takeException(), isNull);
    });
  });

  group('주보 보기', () {
    BulletinViewerScreen screen(
      FakeServer server, {
      String? id = '9',
      List<String>? calls,
    }) => BulletinViewerScreen(
      bulletins: BulletinsApi(clientFor(server)),
      id: id,
      onLogin: () => calls?.add('login'),
      onUpload: () async {
        calls?.add('upload');
        return false;
      },
    );

    /// 상세는 주보마다, 최신은 9번, 목록(달력 날짜)은 최근 세 부
    FakeServer serverWith({int pages = 3}) => FakeServer(
      (RequestOptions o) async => switch (o.path) {
        '/bulletins' => page([
          summary('9', '2026-10-11'),
          summary('8', '2026-10-04'),
          summary('7', '2026-09-27'),
        ]),
        '/bulletins/8' => respond(200, {
          'data': {...detail('8', 1), 'serviceDate': '2026-10-04'},
        }),
        _ => respond(200, {'data': detail('9', pages)}),
      },
    );

    testWidgets('날짜 제목 · 몇 면 중 몇 번째인지 보이고, 넘기면 바뀐다', (tester) async {
      final server = serverWith();
      await pump(tester, screen(server));

      expect(server.paths, contains('GET /bulletins/9'));
      expect(find.text('2026년 10월 11일'), findsOneWidget);
      expect(find.text('1 / 3 면'), findsOneWidget);

      await tester.fling(find.byType(PageView), const Offset(-300, 0), 1000);
      await tester.pumpAndSettle();

      expect(find.text('2 / 3 면'), findsOneWidget);
    });

    testWidgets('주보를 정하지 않고 열면(자료 탭) 최신 주보를 보여준다', (tester) async {
      final server = serverWith();
      await pump(tester, screen(server, id: null));

      expect(server.paths, contains('GET /bulletins/latest'));
      expect(find.text('2026년 10월 11일'), findsOneWidget);
    });

    testWidgets('최신 주보가 아직 없으면 없다고 말한다', (tester) async {
      await pump(
        tester,
        screen(
          FakeServer(
            (o) async => o.path == '/bulletins/latest'
                ? respond(200, {'data': null})
                : page([]),
          ),
          id: null,
        ),
      );

      expect(find.text('아직 올라온 주보가 없어요.'), findsOneWidget);
    });

    testWidgets('[지난 주보]는 달력 — 주보가 있는 날을 고르면 그 주보로 바뀐다', (tester) async {
      final server = serverWith();
      await pump(tester, screen(server));

      await tester.tap(find.text('지난 주보'));
      await tester.pumpAndSettle();
      expect(find.byType(DatePickerDialog), findsOneWidget);

      // 2026-10-04 — 같은 달 달력에 있다
      await tester.tap(find.text('4'));
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();

      expect(server.paths, contains('GET /bulletins/8'));
      expect(find.text('2026년 10월 4일'), findsOneWidget);
      expect(find.text('1 / 1 면'), findsOneWidget);
    });

    testWidgets('달력에서 주보가 없는 날은 고를 수 없다', (tester) async {
      await pump(tester, screen(serverWith()));

      await tester.tap(find.text('지난 주보'));
      await tester.pumpAndSettle();

      // 10월 5일에는 주보가 없다 — 눌러도 그대로다
      await tester.tap(find.text('5'));
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();
      expect(find.text('2026년 10월 11일'), findsOneWidget);
    });

    testWidgets('일반 회원에게는 [주보 올리기]가 없다', (tester) async {
      final auth = await authAs(tester, me('MEMBER'));
      await pump(tester, screen(serverWith()), auth: auth);

      expect(find.text('주보 올리기'), findsNothing);
    });

    testWidgets('임원 이상은 [주보 올리기]로 올리는 화면을 연다', (tester) async {
      final auth = await authAs(tester, me('LEADER'));
      final calls = <String>[];
      await pump(tester, screen(serverWith(), calls: calls), auth: auth);

      await tester.tap(find.text('주보 올리기'));
      await tester.pumpAndSettle();
      expect(calls, ['upload']);
    });

    testWidgets('이미지를 못 받으면(주소 만료 등) 새 주소를 받아 온다', (tester) async {
      final server = serverWith(pages: 2);
      await pump(tester, screen(server));

      // 테스트 환경에서는 네트워크 이미지를 못 받는다 — 실패 화면이 곧 만료 상황이다
      await tester.ensureVisible(find.text('다시 불러오기').first);
      await tester.tap(find.text('다시 불러오기').first);
      // 확대용 두 번 누르기 판정이 끝나야 한 번 누르기가 확정된다
      await tester.pump(kDoubleTapTimeout);
      await tester.pumpAndSettle();

      expect(server.paths.where((p) => p == 'GET /bulletins/9'), hasLength(2));
    });

    testWidgets('없는 주보는 찾을 수 없다고 말한다', (tester) async {
      await pump(
        tester,
        screen(
          FakeServer(
            (_) async => respond(404, {
              'error': {'code': 'NOT_FOUND', 'message': 'x', 'field': null},
            }),
          ),
        ),
      );

      expect(find.text('찾을 수 없는 주보예요.'), findsOneWidget);
    });

    testWidgets('작은 폰(360dp)에서 글자를 2배로 키워도 넘치지 않는다', (tester) async {
      await pump(
        tester,
        screen(serverWith()),
        textScale: 2,
        size: const Size(360, 740),
      );

      expect(tester.takeException(), isNull);
    });
  });
}
