import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/content/links.dart';
import 'package:light_mobile/core/theme/app_theme.dart';
import 'package:light_mobile/features/sermons/sermons_api.dart';
import 'package:light_mobile/features/sermons/sermons_screen.dart';

import '../../support/fake_server.dart';

Map<String, dynamic> sermon(int n) => {
  'id': 'video$n',
  'title': '설교 $n',
  'publishedAt': '2026-09-${(n % 28 + 1).toString().padLeft(2, '0')}T05:00:00Z',
  'youtubeUrl': 'https://www.youtube.com/watch?v=video$n',
  'thumbnailUrl': 'https://i.ytimg.com/vi/video$n/hqdefault.jpg',
};

const live = {
  'videoId': 'SaVEqB82v7Y',
  'title': '2026년 10월 11일 주일 청년예배',
  'startedAt': '2026-10-11T04:45:00Z',
  'watchUrl': 'https://www.youtube.com/watch?v=SaVEqB82v7Y',
  'thumbnailUrl': 'https://i.ytimg.com/vi/SaVEqB82v7Y/hqdefault.jpg',
};

FakeResponse sermonPage(int page, int count, {required bool hasNext}) =>
    respond(200, {
      'data': {
        'items': [for (var i = 0; i < count; i++) sermon(page * 100 + i)],
        'page': page,
        'size': count,
        'hasNext': hasNext,
      },
    });

final serverError = respond(500, {
  'error': {'code': 'INTERNAL_ERROR', 'message': '서버 오류', 'field': null},
});

/// [pages]는 `page` 번호마다의 응답. [liveResponse]가 없으면 방송 중이 아니다
FakeServer serverWith({
  Map<int, FakeResponse>? pages,
  FakeResponse? liveResponse,
}) => FakeServer(
  (RequestOptions o) async => switch (o.path) {
    '/sermons/live' => liveResponse ?? respond(200, {'data': null}),
    '/sermons' =>
      (pages ??
          {0: sermonPage(0, 3, hasNext: false)})[o.queryParameters['page']]!,
    _ => respond(404),
  },
);

Future<List<String>> pumpSermons(
  WidgetTester tester,
  FakeServer server, {
  double textScale = 1,
  Size screen = const Size(411, 914),
}) async {
  tester.view.physicalSize = screen * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  final opened = <String>[];
  await tester.pumpWidget(
    MaterialApp(
      theme: buildAppTheme(),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context)
            .copyWith(textScaler: TextScaler.linear(textScale)),
        child: child!,
      ),
      home: SermonsScreen(
        sermons: SermonsApi(clientFor(server)),
        openExternal: opened.add,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return opened;
}

void main() {
  testWidgets('방송이 없으면 다음 예배 시각과 지난 말씀을 보여준다', (tester) async {
    await pumpSermons(tester, serverWith());

    expect(find.text('주일 14:00 청년예배'), findsOneWidget);
    expect(find.text('LIVE'), findsNothing);
    expect(find.text('지난 말씀'), findsOneWidget);
    expect(find.text('설교 0'), findsOneWidget);
    expect(find.text('설교 2'), findsOneWidget);
  });

  testWidgets('방송 중이면 라이브 카드를 맨 위에 두고, 누르면 YouTube로 간다', (tester) async {
    final opened = await pumpSermons(
      tester,
      serverWith(liveResponse: respond(200, {'data': live})),
    );

    expect(find.text('LIVE'), findsOneWidget);
    expect(find.text('2026년 10월 11일 주일 청년예배'), findsOneWidget);
    expect(find.text('주일 14:00 청년예배'), findsNothing);

    await tester.tap(find.text('지금 보기'));
    expect(opened, ['https://www.youtube.com/watch?v=SaVEqB82v7Y']);
  });

  testWidgets('라이브 조회가 실패해도 조용히 넘어가고 목록은 보여준다', (tester) async {
    await pumpSermons(tester, serverWith(liveResponse: serverError));

    expect(find.text('주일 14:00 청년예배'), findsOneWidget);
    expect(find.text('설교 0'), findsOneWidget);
    expect(find.textContaining('불러오지 못했어요'), findsNothing);
  });

  testWidgets('끝까지 내리면 다음 페이지를 받고, 끝나면 채널 링크를 둔다', (tester) async {
    final server = serverWith(
      pages: {
        0: sermonPage(0, 12, hasNext: true),
        1: sermonPage(1, 2, hasNext: false),
      },
    );
    final opened = await pumpSermons(tester, server);
    expect(find.text('설교 101'), findsNothing);

    await tester.scrollUntilVisible(find.text('유튜브 채널에서 더 보기'), 400);
    await tester.pumpAndSettle();

    expect(find.text('설교 101'), findsOneWidget);
    final pages = [
      for (final r in server.requests)
        if (r.path == '/sermons') r.queryParameters['page'],
    ];
    expect(pages, [0, 1]);

    await tester.tap(find.text('유튜브 채널에서 더 보기'));
    expect(opened, [youtubeChannelUrl]);
  });

  testWidgets('지난 말씀을 누르면 그 영상을 연다', (tester) async {
    final opened = await pumpSermons(tester, serverWith());

    await tester.tap(find.text('설교 1'));

    expect(opened, ['https://www.youtube.com/watch?v=video1']);
  });

  testWidgets('영상이 없으면 없다고 말한다', (tester) async {
    await pumpSermons(
      tester,
      serverWith(pages: {0: sermonPage(0, 0, hasNext: false)}),
    );

    expect(find.text('아직 등록된 영상이 없어요.'), findsOneWidget);
  });

  testWidgets('목록을 못 불러오면 [다시 시도]로 다시 받는다', (tester) async {
    var fail = true;
    final server = FakeServer(
      (o) async => switch (o.path) {
        '/sermons/live' => respond(200, {'data': null}),
        _ when fail => serverError,
        _ => sermonPage(0, 1, hasNext: false),
      },
    );
    await pumpSermons(tester, server);
    expect(find.textContaining('불러오지 못했어요'), findsOneWidget);

    fail = false;
    await tester.tap(find.text('다시 시도'));
    await tester.pumpAndSettle();

    expect(find.text('설교 0'), findsOneWidget);
  });

  testWidgets('60초마다 라이브를 다시 묻는다 — 방송이 시작되면 카드가 바뀐다', (tester) async {
    var onAir = false;
    final server = FakeServer(
      (o) async => switch (o.path) {
        '/sermons/live' => respond(200, {'data': onAir ? live : null}),
        _ => sermonPage(0, 1, hasNext: false),
      },
    );
    await pumpSermons(tester, server);
    expect(find.text('LIVE'), findsNothing);

    onAir = true;
    await tester.pump(livePollInterval);
    await tester.pumpAndSettle();

    expect(find.text('LIVE'), findsOneWidget);
  });

  testWidgets('아래로 당기면 라이브와 목록을 다시 받는다', (tester) async {
    final server = serverWith();
    await pumpSermons(tester, server);

    await tester.fling(find.text('지난 말씀'), const Offset(0, 400), 1000);
    await tester.pumpAndSettle();

    expect(server.paths.where((p) => p == 'GET /sermons'), hasLength(2));
    expect(server.paths.where((p) => p == 'GET /sermons/live'), hasLength(2));
  });

  testWidgets('작은 폰(360dp)에서 글자를 2배로 키워도 넘치지 않는다', (tester) async {
    await pumpSermons(
      tester,
      serverWith(liveResponse: respond(200, {'data': live})),
      textScale: 2,
      screen: const Size(360, 740),
    );
    expect(tester.takeException(), isNull);

    await tester.scrollUntilVisible(find.text('유튜브 채널에서 더 보기'), 300);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
