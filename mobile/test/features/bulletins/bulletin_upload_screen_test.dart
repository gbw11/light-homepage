import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/core/theme/app_theme.dart';
import 'package:light_mobile/features/bulletins/bulletin_upload_screen.dart';
import 'package:light_mobile/features/bulletins/bulletins_api.dart';

import '../../support/fake_server.dart';

/// 1×1 PNG — 미리보기가 실제로 그려지게 진짜 이미지 바이트를 쓴다
final _png = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
);

/// 길이로 구분되는 이미지 — 보낸 순서를 확인할 때 쓴다
UploadImage image(int padding) => (
  bytes: [..._png, ...List.filled(padding, 0)],
  mimeType: 'image/png',
  extension: 'png',
);

final created = respond(201, {
  'data': {'id': '9', 'pageCount': 2},
});

FakeResponse duplicate() => respond(409, {
  'error': {
    'code': 'DUPLICATE',
    'message': '같은 날짜의 주보가 있습니다.',
    'field': 'serviceDate',
  },
});

Future<List<String>> pumpUpload(
  WidgetTester tester,
  FakeServer server, {
  List<UploadImage>? picked,
  double textScale = 1,
  Size size = const Size(411, 914),
}) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final calls = <String>[];
  await tester.pumpWidget(
    MaterialApp(
      theme: buildAppTheme(),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context)
            .copyWith(textScaler: TextScaler.linear(textScale)),
        child: child!,
      ),
      home: BulletinUploadScreen(
        bulletins: BulletinsApi(clientFor(server)),
        pickImages: () async => picked ?? [image(10), image(20)],
        onDone: () => calls.add('done'),
        // 2026-10-13은 화요일이다
        now: () => DateTime(2026, 10, 13, 9),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return calls;
}

final page = find.byType(Scrollable).first;

Future<void> press(WidgetTester tester, Finder finder) async {
  await tester.scrollUntilVisible(finder, 100, scrollable: page);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

Future<void> pick(WidgetTester tester) => press(tester, find.text('사진 고르기'));

Future<void> submit(WidgetTester tester) =>
    press(tester, find.widgetWithText(FilledButton, '올리기'));

/// 보낸 주보 — 날짜와 장마다의 (파일 이름, 크기)
(String, List<(String, int)>) sent(RequestOptions request) {
  final form = request.data as FormData;
  return (
    form.fields.singleWhere((f) => f.key == 'serviceDate').value,
    [
      for (final f in form.files)
        if (f.key == 'pages') (f.value.filename!, f.value.length),
    ],
  );
}

void main() {
  testWidgets('예배 날짜는 다가오는 주일로 시작한다', (tester) async {
    await pumpUpload(tester, FakeServer((_) async => created));

    expect(find.text('2026.10.18 (일)'), findsOneWidget);
  });

  testWidgets('사진 없이 올리면 보내지 않고 알린다', (tester) async {
    final server = FakeServer((_) async => created);
    await pumpUpload(tester, server);

    await submit(tester);

    expect(server.requests, isEmpty);
    expect(find.textContaining('한 장 이상 골라 주세요'), findsOneWidget);
  });

  testWidgets('고른 순서대로 보내고, 화살표로 순서를 바꾼다', (tester) async {
    final server = FakeServer((_) async => created);
    final calls = await pumpUpload(tester, server);

    await pick(tester);
    expect(find.text('1장'), findsOneWidget);
    expect(find.text('2장'), findsOneWidget);

    // 1장을 뒤로 — 두 번째로 고른 사진(더 큰 것)이 1장이 된다
    await press(tester, find.byTooltip('1장을 뒤로'));
    await submit(tester);

    expect(server.paths, ['POST /bulletins']);
    final pngLength = _png.length;
    final (date, pages) = sent(server.requests.single);
    expect(date, '2026-10-18');
    expect(pages, [
      ('page-1.png', pngLength + 20),
      ('page-2.png', pngLength + 10),
    ]);
    expect(calls, ['done']);
  });

  testWidgets('뺀 사진은 보내지 않는다', (tester) async {
    final server = FakeServer((_) async => created);
    await pumpUpload(tester, server);

    await pick(tester);
    await press(tester, find.byTooltip('1장 빼기'));
    await submit(tester);

    final (_, pages) = sent(server.requests.single);
    expect(pages, hasLength(1));
  });

  testWidgets('같은 날짜가 있으면 묻고, 교체하면 기존 주보를 지우고 다시 올린다', (tester) async {
    var posts = 0;
    final server = FakeServer(
      (o) async => switch ((o.method, o.path)) {
        ('POST', '/bulletins') => ++posts == 1 ? duplicate() : created,
        ('GET', '/bulletins') => respond(200, {
          'data': {
            'items': [
              {
                'id': '7',
                'serviceDate': '2026-10-18',
                'pageCount': 2,
                'thumbUrl': null,
              },
            ],
            'page': 0,
            'size': 50,
            'hasNext': false,
          },
        }),
        ('DELETE', '/bulletins/7') => respond(204),
        _ => respond(404),
      },
    );
    final calls = await pumpUpload(tester, server);

    await pick(tester);
    await submit(tester);
    expect(find.text('같은 날짜의 주보가 있어요'), findsOneWidget);

    await tester.tap(find.text('교체'));
    await tester.pumpAndSettle();

    expect(server.paths, [
      'POST /bulletins',
      'GET /bulletins',
      'DELETE /bulletins/7',
      'POST /bulletins',
    ]);
    expect(calls, ['done']);
  });

  testWidgets('교체를 취소하면 아무것도 지우지 않는다', (tester) async {
    final server = FakeServer((_) async => duplicate());
    final calls = await pumpUpload(tester, server);

    await pick(tester);
    await submit(tester);
    await tester.tap(find.text('취소'));
    await tester.pumpAndSettle();

    expect(server.paths, ['POST /bulletins']);
    expect(find.textContaining('날짜를 바꾸거나 교체를'), findsOneWidget);
    expect(calls, isEmpty);
  });

  testWidgets('20장이 넘게 고르면 20장까지만 담고 알린다', (tester) async {
    await pumpUpload(
      tester,
      FakeServer((_) async => created),
      picked: [for (var i = 0; i < 25; i++) image(i)],
    );

    await pick(tester);

    expect(find.textContaining('최대 20장까지'), findsWidgets);
    await tester.scrollUntilVisible(find.text('20장'), 300, scrollable: page);
    expect(find.text('20장'), findsOneWidget);
    expect(find.text('사진 더 고르기'), findsNothing);
  });

  testWidgets('작은 폰(360dp)에서 글자를 2배로 키워도 넘치지 않는다', (tester) async {
    await pumpUpload(
      tester,
      FakeServer((_) async => created),
      textScale: 2,
      size: const Size(360, 740),
    );
    await pick(tester);

    expect(tester.takeException(), isNull);
  });
}
