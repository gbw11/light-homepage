import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/core/auth/auth_state.dart';
import 'package:light_mobile/core/theme/app_theme.dart';
import 'package:light_mobile/features/meetings/meeting_viewer_screen.dart';
import 'package:light_mobile/features/meetings/meetings_api.dart';
import 'package:light_mobile/features/meetings/meetings_screen.dart';

import '../../support/fake_server.dart';

Map<String, dynamic> me(String role) => {
  'id': '42',
  'name': '김도연a',
  'loginId': 'doyeon01',
  'phone': '010-1234-5678',
  'role': role,
};

Map<String, dynamic> summary(String id, String status) => {
  'id': id,
  'title': '$id월 월례회',
  'meetingDate': '2026-10-05',
  'pageCount': 3,
  'viewableFrom': '2026-10-05T11:00:00Z',
  'viewableUntil': '2099-10-07T14:59:00Z',
  'status': status,
};

Map<String, dynamic> detail({
  String status = 'OPEN',
  bool canView = true,
  int remaining = 3600,
}) => {
  'id': '3',
  'title': '10월 월례회',
  'meetingDate': '2026-10-05',
  'pageCount': 3,
  'status': status,
  'viewableUntil': '2026-10-07T14:59:00Z',
  'remainingSeconds': remaining,
  'canView': canView,
  'viewReason': canView ? null : 'PERIOD_CLOSED',
};

FakeResponse forbidden() => respond(403, {
  'error': {'code': 'FORBIDDEN', 'message': '권한이 없습니다.', 'field': null},
});

/// 지난 로그인 확인은 진짜 시계에서 기다려야 끝난다 (위젯 테스트는 가짜 시계)
Future<AuthState> authAs(WidgetTester tester, String role) async {
  final server = FakeServer((_) async => respond(200, {'data': me(role)}));
  final auth = AuthState(clientFor(server));
  await tester.runAsync(auth.restore);
  addTearDown(auth.dispose);
  return auth;
}

Future<void> pump(
  WidgetTester tester,
  Widget screen, {
  required AuthState auth,
  double textScale = 1,
  Size size = const Size(411, 914),
}) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
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
        home: screen,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

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

FilledButton buttonOf(WidgetTester tester, String label) =>
    tester.widget<FilledButton>(find.widgetWithText(FilledButton, label));

void main() {
  group('월례회 목록 — 버튼 규칙', () {
    MeetingsScreen screen(List<Object> items, List<String> opened) =>
        MeetingsScreen(
          meetings: MeetingsApi(
            clientFor(
              FakeServer(
                (_) async => respond(200, {
                  'data': {
                    'items': items,
                    'page': 0,
                    'size': 20,
                    'hasNext': false,
                  },
                }),
              ),
            ),
          ),
          onOpen: (m) => opened.add(m.id),
          onLogin: () {},
          onUpload: () async {
            opened.add('upload');
            return false;
          },
        );

    testWidgets('회원: 기간 안은 [열람하기], 밖은 눌리지 않는 [열람 전] · [열람 종료]', (tester) async {
      final opened = <String>[];
      await pump(
        tester,
        screen([
          summary('10', 'OPEN'),
          summary('11', 'SCHEDULED'),
          summary('9', 'CLOSED'),
        ], opened),
        auth: await authAs(tester, 'MEMBER'),
      );

      expect(buttonOf(tester, '열람 전').onPressed, isNull);
      expect(buttonOf(tester, '열람 종료').onPressed, isNull);
      expect(find.textContaining('임원에게 문의해 주세요'), findsOneWidget);
      expect(find.text('임원 열람'), findsNothing);
      // 올리기는 임원 이상만
      expect(find.text('월례회 자료 올리기'), findsNothing);

      await tester.tap(find.text('열람하기'));
      expect(opened, ['10']);
    });

    testWidgets('임원: 기간 밖도 [임원 열람]으로 연다 — "임원에게 문의"는 보이지 않는다', (tester) async {
      final opened = <String>[];
      await pump(
        tester,
        screen([summary('9', 'CLOSED')], opened),
        auth: await authAs(tester, 'LEADER'),
      );

      // 「열람 종료」는 상태 딱지로만 — 막힌 버튼이 아니라 [임원 열람]이다
      expect(find.widgetWithText(FilledButton, '열람 종료'), findsNothing);
      expect(find.textContaining('임원에게 문의'), findsNothing);
      await tester.tap(find.text('임원 열람'));
      await tester.tap(find.text('월례회 자료 올리기'));
      await tester.pumpAndSettle();
      expect(opened, ['9', 'upload']);
    });

    testWidgets('무엇을 막고 무엇을 못 막는지 사실대로 알린다', (tester) async {
      await pump(
        tester,
        screen([summary('10', 'OPEN')], []),
        auth: await authAs(tester, 'MEMBER'),
      );

      expect(find.textContaining('다른 기기로 찍는 것까지는'), findsOneWidget);
    });

    testWidgets('작은 폰(360dp)에서 글자를 2배로 키워도 넘치지 않는다', (tester) async {
      await pump(
        tester,
        screen([
          summary('10', 'OPEN'),
          summary('11', 'SCHEDULED'),
          summary('9', 'CLOSED'),
        ], []),
        auth: await authAs(tester, 'MEMBER'),
        textScale: 2,
        size: const Size(360, 740),
      );

      expect(tester.takeException(), isNull);
    });
  });

  group('월례회 보기', () {
    // 같은 테스트에서 화면을 다시 띄우면 새 화면으로 만든다 (상태 재사용 방지)
    MeetingViewerScreen screen(FakeServer server) => MeetingViewerScreen(
      key: UniqueKey(),
      meetings: MeetingsApi(clientFor(server)),
      id: '3',
      onLogin: () {},
    );

    /// 상세는 [detailJson], 페이지는 [page]가 정한다
    FakeServer serverWith(
      Map<String, dynamic> detailJson, {
      FakeResponse Function(RequestOptions o)? page,
    }) => FakeServer(
      (o) async => o.path == '/meetings/3'
          ? respond(200, {'data': detailJson})
          : (page?.call(o) ?? respond(200, 'not-a-real-jpeg')),
    );

    testWidgets('열 수 있으면 첫 장부터 받아 보여주고, 그동안 캡처를 막는다', (tester) async {
      final security = recordScreenSecurity(tester);
      final server = serverWith(detail());
      await pump(tester, screen(server), auth: await authAs(tester, 'MEMBER'));

      expect(find.text('1 / 3'), findsOneWidget);
      expect(server.paths, contains('GET /meetings/3/pages/1'));
      // 페이지는 쿠키가 실린 요청으로 바이트를 받는다 (Image.network가 아니다)
      expect(server.requests.last.responseType, ResponseType.bytes);
      expect(security, ['protect']);
      // 워터마크에 무엇이 박히는지 알린다
      expect(find.textContaining('김도연a 5678'), findsOneWidget);

      await tester.pumpWidget(const SizedBox());
      expect(security, ['protect', 'release']);
    });

    testWidgets('넘기면 그 장을 받는다', (tester) async {
      final server = serverWith(detail());
      await pump(tester, screen(server), auth: await authAs(tester, 'MEMBER'));

      await tester.fling(find.byType(PageView), const Offset(-400, 0), 1000);
      await tester.pumpAndSettle();

      expect(find.text('2 / 3'), findsOneWidget);
      expect(server.paths, contains('GET /meetings/3/pages/2'));
    });

    testWidgets('남은 시간이 다 되면 회원에게는 종료 안내로 바뀌고 캡처 막기를 푼다', (tester) async {
      final security = recordScreenSecurity(tester);
      await pump(
        tester,
        screen(serverWith(detail(remaining: 2))),
        auth: await authAs(tester, 'MEMBER'),
      );
      expect(find.textContaining('남음'), findsOneWidget);

      await tester.pump(const Duration(seconds: 3));
      await tester.pumpAndSettle();

      expect(find.textContaining('열람 기간이 끝났어요'), findsOneWidget);
      expect(security, ['protect', 'release']);
    });

    testWidgets('보는 중에 서버가 페이지를 막으면(403) 종료 안내로 바뀐다', (tester) async {
      await pump(
        tester,
        screen(serverWith(detail(), page: (_) => forbidden())),
        auth: await authAs(tester, 'MEMBER'),
      );

      expect(find.textContaining('열람 기간이 끝났어요'), findsOneWidget);
    });

    testWidgets('열람 전 자료는 "아직", 끝난 자료는 "끝났어요"로 구분한다', (tester) async {
      await pump(
        tester,
        screen(serverWith(detail(status: 'SCHEDULED', canView: false))),
        auth: await authAs(tester, 'MEMBER'),
      );
      expect(find.textContaining('아직 열람 기간이 아니에요'), findsOneWidget);

      await pump(
        tester,
        screen(serverWith(detail(status: 'CLOSED', canView: false))),
        auth: await authAs(tester, 'MEMBER'),
      );
      expect(find.textContaining('열람 기간이 끝났어요'), findsOneWidget);
    });

    testWidgets('임원이 기간 밖 자료를 열면 남은 시간 대신 "임원 열람"을 보인다', (tester) async {
      await pump(
        tester,
        screen(serverWith(detail(status: 'CLOSED', remaining: 0))),
        auth: await authAs(tester, 'LEADER'),
      );

      expect(find.text('임원 열람'), findsOneWidget);
      expect(find.textContaining('남음'), findsNothing);
      // 남은 시간 0이어도 임원은 닫히지 않는다
      await tester.pump(const Duration(seconds: 2));
      expect(find.textContaining('열람 기간이 끝났어요'), findsNothing);
    });
  });
}
