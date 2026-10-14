import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/core/theme/app_theme.dart';
import 'package:light_mobile/core/ui/form_card.dart';
import 'package:light_mobile/core/upload/pick_file.dart';
import 'package:light_mobile/features/posts/post_summary.dart';
import 'package:light_mobile/features/posts/post_write_screen.dart';
import 'package:light_mobile/features/posts/posts_api.dart';

import '../../support/fake_server.dart';

const UploadFile sheet = (
  name: '신청서.xlsx',
  bytes: [1, 2, 3],
  mimeType: 'application/vnd.ms-excel',
);

/// 첨부는 올릴 때마다 7, 8 … 을 주고, 글은 19를 준다
FakeServer okServer() {
  var next = 7;
  return FakeServer(
    (RequestOptions o) async => switch (o.path) {
      '/attachments' => respond(201, {
        'data': {'id': '${next++}', 'filename': 'x', 'sizeBytes': 3},
      }),
      '/posts' => respond(201, {
        'data': {'id': '19'},
      }),
      _ => respond(404),
    },
  );
}

Future<List<String>> pumpWrite(
  WidgetTester tester,
  FakeServer server, {
  List<PostCategory> categories = const [
    PostCategory.noticePublic,
    PostCategory.noticeMember,
  ],
  List<UploadFile> picked = const [sheet],
  double textScale = 1,
  Size size = const Size(411, 914),
}) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final done = <String>[];
  await tester.pumpWidget(
    MaterialApp(
      theme: buildAppTheme(),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context)
            .copyWith(textScaler: TextScaler.linear(textScale)),
        child: child!,
      ),
      home: PostWriteScreen(
        posts: PostsApi(clientFor(server)),
        categories: categories,
        pickAttachments: () async => picked,
        onDone: done.add,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return done;
}

final page = find.byType(Scrollable).first;

Finder field(String label) => find.descendant(
  of: find.widgetWithText(CardField, label),
  matching: find.byType(TextFormField),
);

Future<void> press(WidgetTester tester, Finder finder) async {
  await tester.scrollUntilVisible(finder, 100, scrollable: page);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

Future<void> fill(WidgetTester tester, {String title = '10월 셋째 주 광고'}) async {
  await tester.enterText(field('제목'), title);
  await tester.enterText(field('내용'), '첫 문단\n둘째 줄\n\n둘째 문단');
}

Map<String, dynamic> sentPost(FakeServer server) =>
    jsonDecode(jsonEncode(server.requests.last.data)) as Map<String, dynamic>;

void main() {
  testWidgets('공지: 제목 · 내용 · 첨부를 올리고 그 첨부 id로 글을 만든다', (tester) async {
    final server = okServer();
    final done = await pumpWrite(tester, server);

    await fill(tester);
    await press(tester, find.text('파일 첨부'));
    expect(find.text('신청서.xlsx'), findsOneWidget);
    await press(tester, find.widgetWithText(FilledButton, '올리기'));

    expect(server.paths, ['POST /attachments', 'POST /posts']);
    expect(sentPost(server), {
      'category': 'NOTICE_PUBLIC',
      'title': '10월 셋째 주 광고',
      'body': {
        'type': 'doc',
        'content': [
          {
            'type': 'paragraph',
            'content': [
              {'type': 'text', 'text': '첫 문단'},
              {'type': 'hardBreak'},
              {'type': 'text', 'text': '둘째 줄'},
            ],
          },
          {
            'type': 'paragraph',
            'content': [
              {'type': 'text', 'text': '둘째 문단'},
            ],
          },
        ],
      },
      'pinned': false,
      'attachmentIds': ['7'],
      'publish': true,
    });
    expect(done, ['19']);
  });

  testWidgets('「회원만」 · 고정을 고르면 그대로 보낸다', (tester) async {
    final server = okServer();
    await pumpWrite(tester, server, picked: const []);

    await tester.tap(find.text('회원만'));
    await fill(tester);
    await press(tester, find.byType(SwitchListTile));
    await press(tester, find.widgetWithText(FilledButton, '올리기'));

    expect(sentPost(server)['category'], 'NOTICE_MEMBER');
    expect(sentPost(server)['pinned'], true);
    expect(sentPost(server)['attachmentIds'], isEmpty);
  });

  testWidgets('회의록은 분류를 고르는 칸이 없다', (tester) async {
    final server = okServer();
    await pumpWrite(tester, server, categories: const [PostCategory.minutes]);

    expect(find.text('공개 범위'), findsNothing);
    expect(find.text('회의록 쓰기'), findsOneWidget);
    await fill(tester);
    await press(tester, find.widgetWithText(FilledButton, '올리기'));
    expect(sentPost(server)['category'], 'MINUTES');
  });

  testWidgets('제목 · 내용이 비면 보내지 않는다', (tester) async {
    final server = okServer();
    await pumpWrite(tester, server);

    await press(tester, find.widgetWithText(FilledButton, '올리기'));

    expect(server.requests, isEmpty);
    expect(find.text('제목을 입력해 주세요.'), findsOneWidget);
    expect(find.text('내용을 입력해 주세요.'), findsOneWidget);
  });

  testWidgets('8MB가 넘는 첨부는 보내기 전에 막는다', (tester) async {
    final server = okServer();
    await pumpWrite(
      tester,
      server,
      picked: [
        (
          name: 'big.pdf',
          bytes: List.filled(maxUploadBytes + 1, 0),
          mimeType: 'application/pdf',
        ),
      ],
    );

    await fill(tester);
    await press(tester, find.text('파일 첨부'));
    expect(find.textContaining('8MB가 넘는 파일'), findsOneWidget);
    await press(tester, find.widgetWithText(FilledButton, '올리기'));
    expect(server.requests, isEmpty);

    // 빼면 다시 올릴 수 있다
    await press(tester, find.byTooltip('big.pdf 빼기'));
    expect(find.textContaining('8MB가 넘는 파일'), findsNothing);
  });

  testWidgets('쓰던 것이 있으면 나가기 전에 묻는다', (tester) async {
    await pumpWrite(tester, okServer());
    await fill(tester);

    await tester.state<NavigatorState>(find.byType(Navigator)).maybePop();
    await tester.pumpAndSettle();

    expect(find.text('쓰던 글이 있어요'), findsOneWidget);
  });

  testWidgets('작은 폰(360dp)에서 글자를 2배로 키워도 넘치지 않는다', (tester) async {
    await pumpWrite(
      tester,
      okServer(),
      textScale: 2,
      size: const Size(360, 740),
    );
    await press(tester, find.text('파일 첨부'));

    expect(tester.takeException(), isNull);
  });

  group('줄글 → 본문 JSON', () {
    test('앞뒤 빈 줄은 버리고, 빈 줄이 여러 개여도 문단 하나로 나눈다', () {
      final doc = plainTextToDoc('\n\n가\n\n\n\n나\n\n');
      expect((doc['content'] as List).length, 2);
    });

    test('비어 있으면 문단이 없다', () {
      expect(plainTextToDoc('   '), {'type': 'doc', 'content': []});
    });
  });
}
