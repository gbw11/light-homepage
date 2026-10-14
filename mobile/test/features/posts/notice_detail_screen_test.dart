import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/core/theme/app_theme.dart';
import 'package:light_mobile/features/posts/notice_detail_screen.dart';
import 'package:light_mobile/features/posts/posts_api.dart';

import '../../support/fake_server.dart';

Map<String, dynamic> detail({
  bool pinned = false,
  List<Object> attachments = const [],
}) => {
  'id': '18',
  'category': 'NOTICE_PUBLIC',
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
      home: NoticeDetailScreen(
        posts: PostsApi(clientFor(server)),
        idOrSlug: '18',
        openExternal: (url) async => opened.add(url),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return opened;
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
}
