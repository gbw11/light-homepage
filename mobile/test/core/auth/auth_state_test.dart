import 'dart:async';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/core/api/api_client.dart';
import 'package:light_mobile/core/api/api_error.dart';
import 'package:light_mobile/core/auth/auth_state.dart';
import 'package:light_mobile/core/auth/auth_user.dart';

import '../../support/fake_server.dart';

const me = {
  'id': '42',
  'name': '김도연a',
  'loginId': 'doyeon01',
  'phone': '010-1234-5678',
  'role': 'LEADER',
};

/// 쿠키가 지워졌는지 보려고 저장소를 밖에 둔다
({AuthState auth, CookieJar jar, FakeServer server}) setUp(
  Future<FakeResponse> Function(RequestOptions o) handler,
) {
  final jar = CookieJar();
  final server = FakeServer(handler);
  final client = ApiClient(
    baseUrl: 'http://localhost:8080/api',
    cookieJar: jar,
    adapter: server,
  );
  return (auth: AuthState(client), jar: jar, server: server);
}

void main() {
  test('켤 때 쿠키가 살아 있으면 로그인 상태가 된다', () async {
    final t = setUp((_) async => respond(200, {'data': me}));

    expect(t.auth.restoring, isTrue);
    await t.auth.restore();

    expect(t.auth.restoring, isFalse);
    expect(t.auth.user?.name, '김도연a');
    expect(t.auth.user?.role, Role.leader);
    expect(t.auth.user?.loginId, 'doyeon01');
  });

  test('로그인한 적이 없으면 조용히 비로그인 — 세션 만료를 알리지 않는다', () async {
    final t = setUp((_) async => unauthorized());
    var ended = 0;
    t.auth.sessionEnded.listen((_) => ended++);

    await t.auth.restore();
    await pumpEventQueue();

    expect(t.auth.user, isNull);
    expect(t.auth.restoring, isFalse);
    expect(ended, 0);
  });

  test('켤 때 확인이 늦게 끝나도 그 사이의 로그인을 덮어쓰지 않는다', () async {
    final slowMe = Completer<FakeResponse>();
    final t = setUp(
      (o) => switch (o.path) {
        '/auth/me' => slowMe.future,
        _ => Future.value(
          respond(200, {
            'data': {'id': '7', 'name': '새로그인', 'role': 'MEMBER'},
          }),
        ),
      },
    );

    final restoring = t.auth.restore();
    await t.auth.login(loginId: 'new01', password: 'pw');
    slowMe.complete(unauthorized());
    await restoring;

    expect(t.auth.user?.name, '새로그인');
  });

  test('켤 때 네트워크가 끊겨 있으면 잠시 뒤 다시 묻는다 — 로그인이 풀린 채로 두지 않는다', () {
    fakeAsync((async) {
      var online = false;
      final t = setUp(
        (o) async => online
            ? respond(200, {'data': me})
            : throw DioException.connectionError(
                requestOptions: o,
                reason: 'offline',
              ),
      );

      t.auth.restore();
      // 요청이 끝날 만큼만 흘린다 (dio 안에도 타이머가 있다)
      async.elapse(const Duration(seconds: 1));
      expect(t.auth.user, isNull);
      expect(t.auth.restoring, isFalse);

      online = true;
      async.elapse(AuthState.restoreRetryDelays.first);
      async.elapse(const Duration(seconds: 1));

      expect(t.auth.user?.name, '김도연a');
      t.auth.dispose();
    });
  });

  test('401이면 다시 묻지 않는다 — 로그인 안 한 것이 확실하다', () {
    fakeAsync((async) {
      final t = setUp((_) async => unauthorized());

      t.auth.restore();
      // 요청이 끝날 만큼만 흘린다 (dio 안에도 타이머가 있다)
      async.elapse(const Duration(seconds: 1));
      final asked = t.server.paths.length;
      async.elapse(const Duration(minutes: 5));

      expect(t.server.paths, hasLength(asked));
      t.auth.dispose();
    });
  });

  test('로그인하면 응답에 없는 아이디를 넣은 값으로 채운다', () async {
    final t = setUp(
      (_) async => respond(200, {
        'data': {'id': '42', 'name': '김도연a', 'role': 'MEMBER'},
      }),
    );

    await t.auth.login(loginId: 'doyeon01', password: 'pw');

    expect(t.auth.user?.loginId, 'doyeon01');
    expect(t.server.requests.single.data, {
      'loginId': 'doyeon01',
      'password': 'pw',
    });
  });

  test('로그인 실패는 ApiError를 그대로 던지고 상태를 바꾸지 않는다', () async {
    final t = setUp((_) async => unauthorized());

    await expectLater(
      t.auth.login(loginId: 'x', password: 'y'),
      throwsA(isA<ApiError>()),
    );
    expect(t.auth.user, isNull);
  });

  test('로그아웃은 서버가 응답하지 않아도 기기 쪽 쿠키까지 비운다', () async {
    final t = setUp(
      (o) async => switch (o.path) {
        '/auth/me' => respond(200, {'data': me}),
        _ => throw DioException.connectionError(
          requestOptions: o,
          reason: 'offline',
        ),
      },
    );
    await t.auth.restore();
    await t.jar.saveFromResponse(Uri.parse('http://localhost:8080/api'), [
      Cookie('access_token', 'abc'),
    ]);

    await t.auth.logout();

    expect(t.auth.user, isNull);
    expect(
      await t.jar.loadForRequest(Uri.parse('http://localhost:8080/api')),
      isEmpty,
    );
  });

  test('로그인해 있다가 리프레시까지 실패하면 비로그인이 되고 알린다', () async {
    var expired = false;
    final t = setUp(
      (o) async => switch (o.path) {
        '/auth/me' when !expired => respond(200, {'data': me}),
        _ => unauthorized(),
      },
    );
    await t.auth.restore();
    var ended = 0;
    t.auth.sessionEnded.listen((_) => ended++);

    expired = true;
    await expectLater(t.auth.refreshMe(), throwsA(isA<ApiError>()));
    await pumpEventQueue();

    expect(t.auth.user, isNull);
    expect(ended, 1);
  });

  test('연락처를 바꾸면 서버가 준 값으로 갱신한다', () async {
    final t = setUp(
      (o) async => switch (o.method) {
        'PATCH' => respond(200, {
          'data': {...me, 'phone': '010-9999-8888'},
        }),
        _ => respond(200, {'data': me}),
      },
    );
    await t.auth.restore();

    await t.auth.updatePhone('010-9999-8888');

    expect(t.auth.user?.phone, '010-9999-8888');
    expect(t.server.requests.last.data, {'phone': '010-9999-8888'});
  });

  test('모르는 역할은 가장 낮은 권한으로 본다', () {
    expect(Role.parse('ADMIN'), Role.guest);
    expect(Role.parse(null), Role.guest);
    expect(Role.leader.isLeader, isTrue);
    expect(Role.pastor.isLeader, isTrue);
    expect(Role.member.isLeader, isFalse);
  });
}
