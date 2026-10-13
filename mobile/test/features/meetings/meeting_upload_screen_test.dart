import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/core/theme/app_theme.dart';
import 'package:light_mobile/core/upload/pick_file.dart';
import 'package:light_mobile/features/meetings/meeting_upload_screen.dart';
import 'package:light_mobile/features/meetings/meetings_api.dart';

import '../../support/fake_server.dart';

const UploadFile pdf = (
  name: '10월 월례회.pdf',
  bytes: [0x25, 0x50, 0x44, 0x46],
  mimeType: 'application/pdf',
);

final created = respond(201, {
  'data': {'id': '3', 'pageCount': 10},
});

Future<List<String>> pumpUpload(
  WidgetTester tester,
  FakeServer server, {
  UploadFile? picked = pdf,
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
      home: MeetingUploadScreen(
        meetings: MeetingsApi(clientFor(server)),
        pickPdf: () async => picked,
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

Future<void> submit(WidgetTester tester) =>
    press(tester, find.widgetWithText(FilledButton, '올리기'));

void main() {
  testWidgets('오늘 날짜 · 그 달 제목 · 당일 20:00 ~ 이틀 뒤 23:59로 시작한다', (tester) async {
    await pumpUpload(tester, FakeServer((_) async => created));

    expect(find.text('2026.10.13 (화)'), findsOneWidget);
    expect(find.text('2026년 10월 월례회'), findsOneWidget);
    expect(find.text('2026.10.13 (화) 20:00'), findsOneWidget);
    expect(find.text('2026.10.15 (목) 23:59'), findsOneWidget);
  });

  testWidgets('PDF 없이 올리면 보내지 않고 알린다', (tester) async {
    final server = FakeServer((_) async => created);
    await pumpUpload(tester, server);

    await submit(tester);

    expect(server.requests, isEmpty);
    expect(find.textContaining('PDF를 골라 주세요'), findsOneWidget);
  });

  testWidgets('제목 · 날짜 · 열람 기간(UTC) · PDF를 보내고 끝나면 알린다', (tester) async {
    final server = FakeServer((_) async => created);
    final calls = await pumpUpload(tester, server);

    await press(tester, find.text('PDF 고르기'));
    expect(find.text('10월 월례회.pdf'), findsOneWidget);
    await submit(tester);

    expect(server.paths, ['POST /meetings']);
    final form = server.requests.single.data as FormData;
    final fields = {for (final f in form.fields) f.key: f.value};
    expect(fields['title'], '2026년 10월 월례회');
    expect(fields['meetingDate'], '2026-10-13');
    // 기기 시각이 아니라 UTC — 한국에서 9시간 어긋나지 않게
    expect(
      fields['viewableFrom'],
      DateTime(2026, 10, 13, 20).toUtc().toIso8601String(),
    );
    expect(
      fields['viewableUntil'],
      DateTime(2026, 10, 15, 23, 59).toUtc().toIso8601String(),
    );
    expect(form.files.single.value.filename, '10월 월례회.pdf');
    expect(calls, ['done']);
  });

  testWidgets('서버가 PDF를 거절하면(암호화 등) PDF 칸 아래에 알린다', (tester) async {
    final calls = await pumpUpload(
      tester,
      FakeServer(
        (_) async => respond(400, {
          'error': {
            'code': 'VALIDATION_ERROR',
            'message': '암호가 걸린 PDF는 올릴 수 없습니다.',
            'field': 'file',
          },
        }),
      ),
    );

    await press(tester, find.text('PDF 고르기'));
    await submit(tester);

    expect(find.textContaining('암호가 걸린 PDF'), findsOneWidget);
    expect(calls, isEmpty);
  });

  testWidgets('8MB가 넘는 PDF는 고르자마자 알린다', (tester) async {
    final server = FakeServer((_) async => created);
    await pumpUpload(
      tester,
      server,
      picked: (
        name: 'big.pdf',
        bytes: List.filled(maxUploadBytes + 1, 0),
        mimeType: 'application/pdf',
      ),
    );

    await press(tester, find.text('PDF 고르기'));
    expect(find.textContaining('8MB를 넘어요'), findsOneWidget);

    await submit(tester);
    expect(server.requests, isEmpty);
  });

  testWidgets('작은 폰(360dp)에서 글자를 2배로 키워도 넘치지 않는다', (tester) async {
    await pumpUpload(
      tester,
      FakeServer((_) async => created),
      textScale: 2,
      size: const Size(360, 740),
    );
    await press(tester, find.text('PDF 고르기'));

    expect(tester.takeException(), isNull);
  });
}
