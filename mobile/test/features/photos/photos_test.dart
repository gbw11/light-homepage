import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/core/paging/paged_list.dart';
import 'package:light_mobile/core/theme/app_theme.dart';
import 'package:light_mobile/core/ui/signed_image.dart';
import 'package:light_mobile/features/photos/album.dart';
import 'package:light_mobile/features/photos/album_screen.dart';
import 'package:light_mobile/features/photos/albums_screen.dart';
import 'package:light_mobile/features/photos/photo_viewer_screen.dart';
import 'package:light_mobile/features/photos/photos_api.dart';

import '../../support/fake_server.dart';

Map<String, dynamic> album(String id, String title, {int count = 12}) => {
  'id': id,
  'title': title,
  'eventDate': '2026-09-04',
  'photoCount': count,
  'coverThumbUrl': 'https://r2.example.com/a/$id/cover.webp?sig=x',
};

Map<String, dynamic> photo(int n) => {
  'id': '$n',
  'thumbUrl': 'https://r2.example.com/p/$n-thumb.webp?sig=x',
  'viewUrl': 'https://r2.example.com/p/$n-view.webp?sig=x',
  'width': 2560,
  'height': 1707,
};

/// 사진을 [total]장 가진 앨범. 커서는 다음 사진 번호다
FakeServer albumServer(int total, {List<Object>? reports}) =>
    FakeServer((RequestOptions o) async {
      if (o.method == 'POST') {
        reports?.add(o.data as Object);
        return respond(204);
      }
      final size = o.queryParameters['size'] as int;
      final from = int.parse(o.queryParameters['cursor'] as String? ?? '0');
      final to = (from + size).clamp(0, total);
      return respond(200, {
        'data': {
          'items': [for (var i = from; i < to; i++) photo(i)],
          'nextCursor': to < total ? '$to' : null,
          'hasNext': to < total,
        },
      });
    });

/// 격자의 n번째 사진 칸 (1부터). 칸이 누를 수 있는 버튼이라 이름이 다른 글자와
/// 합쳐져 읽히므로 위젯으로 찾는다
Finder tile(int n) => find.byWidgetPredicate(
  (w) => w is SignedImage && w.semanticLabel == '사진 $n',
);

/// 사진 칸을 누른다. 테스트에서는 네트워크 이미지가 실패해서 칸 안이 [다시 불러오기]
/// 버튼으로 바뀐다 — 그 버튼 대신 칸 자체(바깥 InkWell)를 누른다
Future<void> openTile(WidgetTester tester, int n) async {
  final cell = tester.widget<InkWell>(
    find.ancestor(of: tile(n), matching: find.byType(InkWell)).first,
  );
  cell.onTap!();
  await tester.pumpAndSettle();
}

Future<void> pump(
  WidgetTester tester,
  Widget screen, {
  double textScale = 1,
  Size size = const Size(411, 914),
}) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      theme: buildAppTheme(),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context)
            .copyWith(textScaler: TextScaler.linear(textScale)),
        child: child!,
      ),
      home: screen,
    ),
  );
  await tester.pumpAndSettle();
}

AlbumScreen albumScreen(FakeServer server, {int count = 12}) => AlbumScreen(
  photos: PhotosApi(clientFor(server)),
  albumId: '3',
  album: Album.fromJson(album('3', '여름 수련회', count: count)),
  onLogin: () {},
);

void main() {
  group('앨범 목록', () {
    testWidgets('대표 사진 · 제목 · 날짜 · 장 수를 보이고, 누르면 그 앨범을 연다', (tester) async {
      final opened = <String>[];
      await pump(
        tester,
        AlbumsScreen(
          photos: PhotosApi(
            clientFor(
              FakeServer(
                (_) async => respond(200, {
                  'data': {
                    'items': [album('3', '여름 수련회', count: 243)],
                    'page': 0,
                    'size': 20,
                    'hasNext': false,
                  },
                }),
              ),
            ),
          ),
          onOpen: (a) => opened.add(a.title),
          onLogin: () {},
        ),
      );

      expect(find.text('여름 수련회'), findsOneWidget);
      expect(find.text('2026.09.04'), findsOneWidget);
      expect(find.text('243장'), findsOneWidget);
      await tester.tap(find.text('여름 수련회'));
      expect(opened, ['여름 수련회']);
    });

    testWidgets('세션이 끊겼으면(401) 로그인 안내를 둔다', (tester) async {
      var login = 0;
      await pump(
        tester,
        AlbumsScreen(
          photos: PhotosApi(clientFor(FakeServer((_) async => unauthorized()))),
          onOpen: (_) {},
          onLogin: () => login++,
        ),
      );

      await tester.tap(find.widgetWithText(FilledButton, '로그인'));
      expect(login, 1);
    });
  });

  group('앨범 안', () {
    testWidgets('3열 격자로 보이고, 끝까지 내리면 커서로 다음 사진을 받는다', (tester) async {
      final server = albumServer(45);
      await pump(tester, albumScreen(server, count: 45));

      expect(tile(1), findsOneWidget);
      expect(tile(45), findsNothing);

      await tester.scrollUntilVisible(
        tile(45),
        500,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.pumpAndSettle();

      expect(tile(45), findsOneWidget);
      expect(
        [for (final r in server.requests) r.queryParameters['cursor']],
        [null, '30'],
      );
    });

    testWidgets('사진이 없으면 없다고 말한다', (tester) async {
      await pump(tester, albumScreen(albumServer(0), count: 0));

      expect(find.text('아직 올라온 사진이 없어요.'), findsOneWidget);
    });

    testWidgets('사진을 누르면 크게 보기가 그 장부터 열린다', (tester) async {
      await pump(tester, albumScreen(albumServer(12)));

      await openTile(tester, 3);
      await tester.pumpAndSettle();

      expect(find.text('3 / 12'), findsOneWidget);
      await tester.fling(find.byType(PageView), const Offset(-400, 0), 1000);
      await tester.pumpAndSettle();
      expect(find.text('4 / 12'), findsOneWidget);
    });

    testWidgets('크게 보기에서 끝에 가까워지면 다음 사진을 받아 이어서 넘긴다', (tester) async {
      final server = albumServer(35);
      final photos = PhotosApi(clientFor(server));
      final list = PagedList<Photo>(
        () => CursorPageSource(
          (cursor) => photos.photos('3', cursor: cursor, size: 30),
        ),
      );
      addTearDown(list.dispose);
      await tester.runAsync(list.loadMore);
      expect(list.items, hasLength(30));

      // 받아 둔 30장 중 28번째부터 본다
      await pump(
        tester,
        PhotoViewerScreen(
          photos: photos,
          list: list,
          initialIndex: 27,
          total: 35,
        ),
      );
      await tester.fling(find.byType(PageView), const Offset(-400, 0), 1000);
      await tester.pumpAndSettle();

      expect(find.text('29 / 35'), findsOneWidget);
      expect(server.requests, hasLength(2));
      expect(list.items, hasLength(35));
    });
  });

  group('신고 · 삭제 요청', () {
    Future<List<Object>> openSheet(WidgetTester tester) async {
      final reports = <Object>[];
      await pump(tester, albumScreen(albumServer(3, reports: reports)));
      await openTile(tester, 2);
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('사진 신고 · 삭제 요청'));
      await tester.pumpAndSettle();
      return reports;
    }

    testWidgets('내용 없이는 보내지 않는다', (tester) async {
      final reports = await openSheet(tester);

      await tester.tap(find.text('보내기'));
      await tester.pumpAndSettle();

      expect(find.text('요청 내용을 입력해주세요.'), findsOneWidget);
      expect(reports, isEmpty);
    });

    testWidgets('보내면 닫고, 처리를 약속하지 않는 문구로 알린다', (tester) async {
      final reports = await openSheet(tester);

      await tester.enterText(find.byType(TextFormField), ' 본인 사진 삭제 요청합니다 ');
      await tester.tap(find.text('보내기'));
      await tester.pumpAndSettle();

      expect(reports, [
        {'reason': '본인 사진 삭제 요청합니다'},
      ]);
      expect(find.text('사진 신고 · 삭제 요청'), findsNothing);
      expect(find.text('요청이 접수됐어요.'), findsOneWidget);
      // 지금 서버는 신고를 로그로만 남긴다 — 결과를 알려준다고 약속하지 않는다
      expect(find.textContaining('알려드립니다'), findsNothing);
    });
  });

  testWidgets('작은 폰(360dp)에서 글자를 2배로 키워도 앨범 목록이 넘치지 않는다', (tester) async {
    await pump(
      tester,
      AlbumsScreen(
        photos: PhotosApi(
          clientFor(
            FakeServer(
              (_) async => respond(200, {
                'data': {
                  'items': [
                    album('3', '아주 긴 앨범 제목이 들어와도 두 줄에서 끝나야 하는 2026 여름 수련회'),
                  ],
                  'page': 0,
                  'size': 20,
                  'hasNext': false,
                },
              }),
            ),
          ),
        ),
        onOpen: (_) {},
        onLogin: () {},
      ),
      textScale: 2,
      size: const Size(360, 740),
    );

    expect(tester.takeException(), isNull);
  });
}
