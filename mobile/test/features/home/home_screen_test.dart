import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/core/theme/app_theme.dart';
import 'package:light_mobile/features/home/home_screen.dart';
import 'package:light_mobile/features/posts/posts_api.dart';
import 'package:light_mobile/features/sermons/sermons_api.dart';

import '../../support/fake_server.dart';

Map<String, dynamic> notice(String id, String title, {bool pinned = false}) => {
  'id': id,
  'category': 'NOTICE_PUBLIC',
  'title': title,
  'slug': 'notice-$id',
  'pinned': pinned,
  'authorName': '김도연a',
  'publishedAt': '2026-10-0${id}T03:00:00Z',
  'attachmentCount': 0,
};

const sermon = {
  'id': 'dQw4w9WgXcQ',
  'title': '오늘, 다시 시작하는 믿음',
  'publishedAt': '2026-10-04T05:00:00Z',
  'youtubeUrl': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'thumbnailUrl': 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
};

FakeResponse page(List<Object> items) => respond(200, {
  'data': {'items': items, 'page': 0, 'size': items.length, 'hasNext': false},
});

/// 경로별 응답을 정하는 가짜 서버
FakeServer serverWith({FakeResponse? notices, FakeResponse? sermons}) =>
    FakeServer(
      (RequestOptions o) async => switch (o.path) {
        '/posts' => notices ?? page([notice('1', '첫 공지')]),
        '/sermons' => sermons ?? page([sermon]),
        _ => respond(404),
      },
    );

/// 홈이 부른 바깥 동작을 기록한다
class Recorder {
  final calls = <String>[];

  HomeActions get actions => HomeActions(
    onFirstVisit: () => calls.add('firstVisit'),
    onDirections: () => calls.add('directions'),
    onOpenNotice: (n) => calls.add('notice:${n.id}'),
    onSeeAllNotices: () => calls.add('allNotices'),
    onOpenSermon: (s) => calls.add('sermon:${s.id}'),
    onSeeAllSermons: () => calls.add('allSermons'),
  );
}

Future<Recorder> pumpHome(
  WidgetTester tester,
  FakeServer server, {
  double textScale = 1,
  // 기본 테스트 화면(800×600 가로)은 폰과 달라서 16:9 사진이 공지를 화면 밖으로 민다.
  // 에뮬레이터 Medium Phone과 같은 세로 화면에서 본다
  Size screen = const Size(411, 914),
}) async {
  tester.view.physicalSize = screen * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  final recorder = Recorder();
  final api = clientFor(server);
  await tester.pumpWidget(
    MaterialApp(
      theme: buildAppTheme(),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context)
            .copyWith(textScaler: TextScaler.linear(textScale)),
        child: child!,
      ),
      home: HomeScreen(
        posts: PostsApi(api),
        sermons: SermonsApi(api),
        actions: recorder.actions,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return recorder;
}

void main() {
  testWidgets('맨 위에 예배 시간·장소·버튼 2개가 있다 (WIREFRAME §1)', (tester) async {
    await pumpHome(tester, serverWith());

    expect(find.text('주일 14:00 · 청년예배'), findsOneWidget);
    expect(find.text('드림센터 4층'), findsOneWidget);
    expect(find.text('처음 오시는 분'), findsOneWidget);
    expect(find.text('오시는 길'), findsOneWidget);
  });

  testWidgets('공개 공지 3개와 최신 설교 1개를 요청한다', (tester) async {
    final server = serverWith();
    await pumpHome(tester, server);

    final posts = server.requests.firstWhere((r) => r.path == '/posts');
    expect(posts.queryParameters, {'category': 'NOTICE_PUBLIC', 'size': 3});
    final sermons = server.requests.firstWhere((r) => r.path == '/sermons');
    expect(sermons.queryParameters, {'size': 1});
  });

  testWidgets('공지를 날짜와 제목으로 보여준다', (tester) async {
    await pumpHome(
      tester,
      serverWith(
        notices: page([
          notice('5', '10월 셋째 주 광고', pinned: true),
          notice('1', '가을 수련회 신청 안내'),
        ]),
      ),
    );

    expect(find.text('10월 셋째 주 광고'), findsOneWidget);
    expect(find.text('가을 수련회 신청 안내'), findsOneWidget);
    final local = DateTime.utc(2026, 10, 5, 3).toLocal();
    expect(find.text('${local.month}/${local.day}'), findsOneWidget);
  });

  testWidgets('공지가 없으면 없다고 말한다', (tester) async {
    await pumpHome(tester, serverWith(notices: page([])));

    expect(find.text('새 공지가 없어요.'), findsOneWidget);
  });

  testWidgets('공지를 못 불러오면 다시 시도하는 법을 알려준다', (tester) async {
    await pumpHome(
      tester,
      serverWith(
        notices: respond(500, {
          'error': {
            'code': 'INTERNAL_ERROR',
            'message': '서버 오류',
            'field': null,
          },
        }),
      ),
    );

    expect(find.textContaining('공지를 불러오지 못했어요'), findsOneWidget);
  });

  testWidgets('최신 설교를 제목·날짜로 보여준다', (tester) async {
    await pumpHome(tester, serverWith());
    await tester.scrollUntilVisible(find.text('▸ 지난 말씀 전체보기'), 200);

    expect(find.text('최근 말씀'), findsOneWidget);
    expect(find.text('오늘, 다시 시작하는 믿음'), findsOneWidget);
    // 썸네일은 테스트 환경에서 못 받아오므로 자리표시자로 넘어간다 — 그것도 확인된다
    expect(find.text('▶ 영상 보기'), findsOneWidget);
  });

  for (final (name, response) in [
    ('설교가 없으면', page([])),
    (
      'YouTube가 실패해 502가 오면',
      respond(502, {
        'error': {
          'code': 'INTERNAL_ERROR',
          'message': 'bad gateway',
          'field': null,
        },
      }),
    ),
  ]) {
    testWidgets('$name 최근 말씀 칸을 숨긴다', (tester) async {
      await pumpHome(tester, serverWith(sermons: response));

      expect(find.text('최근 말씀'), findsNothing);
      // 공지 칸은 영향받지 않는다
      expect(find.text('첫 공지'), findsOneWidget);
    });
  }

  testWidgets('누르면 바깥에 알린다 — 이동은 홈이 정하지 않는다', (tester) async {
    final recorder = await pumpHome(tester, serverWith());

    await tester.tap(find.text('처음 오시는 분'));
    await tester.tap(find.text('오시는 길'));
    await tester.tap(find.text('첫 공지'));
    await tester.tap(find.text('▸ 공지 전체보기'));
    await tester.scrollUntilVisible(find.text('▸ 지난 말씀 전체보기'), 200);
    await tester.tap(find.text('오늘, 다시 시작하는 믿음'));
    // scrollUntilVisible은 화면 끝에 걸치게만 올려서 탭이 빗나갈 수 있다
    await tester.ensureVisible(find.text('▸ 지난 말씀 전체보기'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('▸ 지난 말씀 전체보기'));

    expect(recorder.calls, [
      'firstVisit',
      'directions',
      'notice:1',
      'allNotices',
      'sermon:dQw4w9WgXcQ',
      'allSermons',
    ]);
  });

  testWidgets('아래로 당기면 다시 불러온다', (tester) async {
    final server = serverWith();
    await pumpHome(tester, server);
    expect(server.paths.where((p) => p == 'GET /posts'), hasLength(1));

    await tester.fling(find.byType(ListView), const Offset(0, 400), 1000);
    await tester.pumpAndSettle();

    expect(server.paths.where((p) => p == 'GET /posts'), hasLength(2));
    expect(server.paths.where((p) => p == 'GET /sermons'), hasLength(2));
  });

  testWidgets('작은 폰(360dp)에서 글자를 2배로 키워도 화면이 넘치지 않는다', (tester) async {
    await pumpHome(
      tester,
      serverWith(
        notices: page([
          notice('5', '아주 긴 공지 제목이 들어오면 두 줄에서 말줄임표로 끝나야 하고 화면 밖으로 밀려나면 안 됩니다'),
          notice('3', '가을 수련회 신청 안내'),
          notice('1', '10월 셋째 주 광고'),
        ]),
      ),
      textScale: 2,
      screen: const Size(360, 740),
    );
    expect(tester.takeException(), isNull);

    // 맨 아래까지 내려가며 그려지는 모든 칸을 확인한다
    await tester.scrollUntilVisible(find.text('▸ 지난 말씀 전체보기'), 300);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
