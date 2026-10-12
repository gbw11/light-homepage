import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/core/api/api_error.dart';

import '../../support/fake_server.dart';

void main() {
  group('응답 봉투', () {
    test('성공이면 data만 꺼낸다', () async {
      final client = clientFor(
        FakeServer(
          (_) async => respond(200, {
            'data': {'id': '42', 'name': '김도연a'},
          }),
        ),
      );

      final me = await client.get(
        '/auth/me',
        decode: (d) => d as Map<String, dynamic>,
      );

      expect(me, {'id': '42', 'name': '김도연a'});
    });

    test('실패면 code·message·field·status를 담은 ApiError를 던진다', () async {
      final client = clientFor(
        FakeServer(
          (_) async => respond(409, {
            'error': {
              'code': 'DUPLICATE',
              'message': '이미 쓰는 아이디입니다.',
              'field': 'loginId',
            },
          }),
        ),
      );

      await expectLater(
        client.post('/auth/register', body: {}, decode: (_) {}),
        throwsA(
          isA<ApiError>()
              .having((e) => e.code, 'code', ErrorCode.duplicate)
              .having((e) => e.message, 'message', '이미 쓰는 아이디입니다.')
              .having((e) => e.field, 'field', 'loginId')
              .having((e) => e.status, 'status', 409),
        ),
      );
    });

    test('집합 밖의 코드는 unknown이 된다', () async {
      final client = clientFor(
        FakeServer(
          (_) async => respond(400, {
            'error': {'code': 'SOMETHING_NEW', 'message': '?', 'field': null},
          }),
        ),
      );

      await expectLater(
        client.get('/posts', decode: (_) {}),
        throwsA(
          isA<ApiError>().having((e) => e.code, 'code', ErrorCode.unknown),
        ),
      );
    });

    test('JSON이 아닌 응답(502 HTML 등)은 INTERNAL_ERROR로 바꾼다', () async {
      final client = clientFor(
        FakeServer((_) async => respond(502, '<html>Bad Gateway</html>')),
      );

      await expectLater(
        client.get('/posts', decode: (_) {}),
        throwsA(
          isA<ApiError>()
              .having((e) => e.code, 'code', ErrorCode.internalError)
              .having((e) => e.status, 'status', 502),
        ),
      );
    });

    test('204는 본문을 해석하지 않는다', () async {
      final client = clientFor(FakeServer((_) async => respond(204)));

      await client.postNoContent('/auth/logout');
    });

    test('값이 null인 쿼리 파라미터는 보내지 않는다', () async {
      final server = FakeServer((_) async => respond(200, {'data': null}));
      final client = clientFor(server);

      await client.get(
        '/posts',
        query: {'page': 0, 'category': null},
        decode: (_) {},
      );

      expect(server.requests.single.queryParameters, {'page': 0});
    });
  });

  group('쿠키', () {
    test('로그인 응답의 Set-Cookie를 보관했다가 다음 요청에 싣는다', () async {
      final server = FakeServer(
        (o) async => o.path == '/auth/login'
            ? respond(
                200,
                {
                  'data': {'id': '42'},
                },
                {
                  'set-cookie': ['access_token=abc; Path=/; HttpOnly'],
                },
              )
            : respond(200, {'data': null}),
      );
      final client = clientFor(server);

      await client.post('/auth/login', body: {}, decode: (_) {});
      await client.get('/auth/me', decode: (_) {});

      expect(
        server.requests.last.headers['cookie'],
        contains('access_token=abc'),
      );
    });
  });

  group('401 → 리프레시 (SPEC_API §12.2)', () {
    test('리프레시가 성공하면 원래 요청을 1회 재시도한다', () async {
      var refreshed = false;
      final server = FakeServer((o) async {
        if (o.path == '/auth/refresh') {
          refreshed = true;
          return respond(200, {
            'data': {'refreshed': true},
          });
        }
        return refreshed ? respond(200, {'data': 'ok'}) : unauthorized();
      });
      final client = clientFor(server);

      final result = await client.get('/posts', decode: (d) => d);

      expect(result, 'ok');
      expect(server.paths, ['GET /posts', 'POST /auth/refresh', 'GET /posts']);
    });

    test('재시도한 요청이 또 401이면 다시 리프레시하지 않고 던진다', () async {
      final server = FakeServer(
        (o) async => o.path == '/auth/refresh'
            ? respond(200, {
                'data': {'refreshed': true},
              })
            : unauthorized(),
      );
      final client = clientFor(server);

      await expectLater(
        client.get('/posts', decode: (_) {}),
        throwsA(isA<ApiError>()),
      );
      expect(server.paths, ['GET /posts', 'POST /auth/refresh', 'GET /posts']);
    });

    test('동시에 터진 401은 리프레시 1번을 공유한다 (토큰 회전)', () async {
      var refreshed = false;
      final server = FakeServer((o) async {
        if (o.path == '/auth/refresh') {
          await Future<void>.delayed(const Duration(milliseconds: 20));
          refreshed = true;
          return respond(200, {
            'data': {'refreshed': true},
          });
        }
        return refreshed ? respond(200, {'data': o.path}) : unauthorized();
      });
      final client = clientFor(server);

      final results = await Future.wait([
        client.get('/posts', decode: (d) => d),
        client.get('/bulletins/latest', decode: (d) => d),
        client.get('/albums', decode: (d) => d),
      ]);

      expect(results, ['/posts', '/bulletins/latest', '/albums']);
      expect(
        server.paths.where((p) => p == 'POST /auth/refresh'),
        hasLength(1),
      );
    });

    test('리프레시가 실패하면 세션 만료를 알리고 원래 요청의 401을 던진다', () async {
      final server = FakeServer(
        (o) async => o.path == '/auth/refresh'
            ? respond(401, {
                'error': {
                  'code': 'UNAUTHORIZED',
                  'message': '리프레시 실패',
                  'field': null,
                },
              })
            : unauthorized(),
      );
      final client = clientFor(server);
      var expired = 0;
      client.sessionExpired.listen((_) => expired++);

      await expectLater(
        client.get('/posts', decode: (_) {}),
        throwsA(
          isA<ApiError>().having((e) => e.message, 'message', '로그인이 필요합니다.'),
        ),
      );
      await Future<void>.delayed(Duration.zero);
      expect(expired, 1);
    });

    for (final path in [
      '/auth/login',
      '/auth/verify-roster',
      '/auth/register',
      '/auth/password/reset-with-code',
    ]) {
      test('$path의 401은 리프레시하지 않는다', () async {
        final server = FakeServer((_) async => unauthorized());
        final client = clientFor(server);

        await expectLater(
          client.post(path, body: {}, decode: (_) {}),
          throwsA(
            isA<ApiError>().having(
              (e) => e.code,
              'code',
              ErrorCode.unauthorized,
            ),
          ),
        );
        expect(server.paths, ['POST $path']);
      });
    }

    test('401이 아닌 에러는 리프레시하지 않는다', () async {
      final server = FakeServer(
        (_) async => respond(403, {
          'error': {'code': 'FORBIDDEN', 'message': '권한이 없습니다.', 'field': null},
        }),
      );
      final client = clientFor(server);

      await expectLater(
        client.get('/admin/members', decode: (_) {}),
        throwsA(isA<ApiError>()),
      );
      expect(server.paths, ['GET /admin/members']);
    });
  });

  group('이동 주소만 받기 — 첨부 다운로드 (SPEC_API §4.2)', () {
    test('302를 따라가지 않고 Location을 돌려준다', () async {
      final server = FakeServer(
        (_) async => respond(302, null, {
          'location': ['https://r2.example.com/a.pdf?sig=1'],
        }),
      );

      final url = await clientFor(server).redirectLocation('/files/7');

      expect(url, Uri.parse('https://r2.example.com/a.pdf?sig=1'));
      expect(server.requests.single.followRedirects, isFalse);
    });

    test('권한이 없으면 다른 요청처럼 ApiError를 던진다', () async {
      final client = clientFor(
        FakeServer(
          (_) async => respond(404, {
            'error': {'code': 'NOT_FOUND', 'message': '없음', 'field': null},
          }),
        ),
      );

      await expectLater(
        client.redirectLocation('/files/7'),
        throwsA(
          isA<ApiError>().having((e) => e.code, 'code', ErrorCode.notFound),
        ),
      );
    });

    test('401이면 리프레시하고 한 번 더 묻는다', () async {
      var first = true;
      final server = FakeServer((o) async {
        if (o.path == '/auth/refresh') return respond(204);
        if (first) {
          first = false;
          return unauthorized();
        }
        return respond(302, null, {
          'location': ['https://r2.example.com/a.pdf'],
        });
      });

      final url = await clientFor(server).redirectLocation('/files/7');

      expect(url.host, 'r2.example.com');
      expect(server.paths, [
        'GET /files/7',
        'POST /auth/refresh',
        'GET /files/7',
      ]);
    });
  });

  group('바이트 받기 — 월례회 페이지 (SPEC_API §7.3)', () {
    test('성공하면 본문 바이트를 그대로 준다', () async {
      final server = FakeServer((_) async => respond(200, 'JPEGDATA'));

      final bytes = await clientFor(server).getBytes('/meetings/3/pages/1');

      expect(String.fromCharCodes(bytes), 'JPEGDATA');
    });

    test('실패는 JSON 봉투로 와도 ApiError로 바꾼다', () async {
      final client = clientFor(
        FakeServer(
          (_) async => respond(403, {
            'error': {'code': 'FORBIDDEN', 'message': '기간 밖', 'field': null},
          }),
        ),
      );

      await expectLater(
        client.getBytes('/meetings/3/pages/1'),
        throwsA(
          isA<ApiError>().having((e) => e.code, 'code', ErrorCode.forbidden),
        ),
      );
    });

    test('30분이 지나 401이면 리프레시하고 한 번 더 받는다', () async {
      var first = true;
      final server = FakeServer((o) async {
        if (o.path == '/auth/refresh') return respond(204);
        if (first) {
          first = false;
          return unauthorized();
        }
        return respond(200, 'JPEG');
      });

      final bytes = await clientFor(server).getBytes('/meetings/3/pages/2');

      expect(String.fromCharCodes(bytes), 'JPEG');
      expect(server.paths, [
        'GET /meetings/3/pages/2',
        'POST /auth/refresh',
        'GET /meetings/3/pages/2',
      ]);
    });
  });
}
