import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/app/push_service.dart';
import 'package:light_mobile/core/auth/auth_state.dart';
import 'package:light_mobile/core/push/devices_api.dart';
import 'package:light_mobile/core/push/push_messaging.dart';

import '../support/fake_server.dart';

/// Firebase 대신 끼우는 가짜 — 무엇을 물었는지 기록하고, 푸시 도착을 흉내 낸다
class FakePushMessaging implements PushMessaging {
  FakePushMessaging({this.currentToken = 'token-1', this.initialMessage});

  String? currentToken;
  PushPayload? initialMessage;
  var permissionAsked = 0;
  final topics = <String>[];
  Object? subscribeError;

  final refreshes = StreamController<String>.broadcast();
  final foregrounds = StreamController<PushPayload>.broadcast();
  final opens = StreamController<PushPayload>.broadcast();

  @override
  Future<bool> requestPermission() async {
    permissionAsked++;
    return true;
  }

  @override
  Future<String?> token() async => currentToken;

  @override
  Stream<String> get tokenRefresh => refreshes.stream;

  @override
  Future<void> subscribe(String topic) async {
    if (subscribeError case final error?) throw error;
    topics.add(topic);
  }

  @override
  Stream<PushPayload> get foreground => foregrounds.stream;

  @override
  Stream<PushPayload> get opened => opens.stream;

  @override
  Future<PushPayload?> initial() async => initialMessage;
}

PushPayload payload(Map<String, dynamic> data, {String? title, String? body}) =>
    (title: title, body: body, data: data);

const member = {
  'data': {'id': '7', 'name': '김도연a', 'role': 'MEMBER'},
};

/// 로그인 · 기기 등록을 받아 주는 서버. [devicesFail]이면 기기 API만 실패한다
FakeServer server({bool devicesFail = false}) => FakeServer(
  (RequestOptions o) async => switch (o.path) {
    '/auth/me' => unauthorized(),
    '/auth/login' => respond(200, member),
    '/auth/logout' => respond(204),
    _ when o.path.startsWith('/me/devices') =>
      devicesFail
          ? respond(500, {
              'error': {
                'code': 'INTERNAL_ERROR',
                'message': '오류',
                'field': null,
              },
            })
          : respond(204),
    _ => respond(404),
  },
);

void main() {
  late FakePushMessaging messaging;
  late FakeServer fake;
  late AuthState auth;
  late PushService push;
  late List<String> opened;
  late List<(PushPayload, String?)> shown;

  void setUpPush({FakeServer? using, FakePushMessaging? fakeMessaging}) {
    messaging = fakeMessaging ?? FakePushMessaging();
    fake = using ?? server();
    final client = clientFor(fake);
    auth = AuthState(client);
    opened = [];
    shown = [];
    push = PushService(
      messaging: messaging,
      devices: DevicesApi(client),
      auth: auth,
      onOpen: opened.add,
      onForeground: (p, path) => shown.add((p, path)),
    );
    addTearDown(() {
      push.dispose();
      auth.dispose();
    });
  }

  List<String> devicePaths() => [
    for (final p in fake.paths)
      if (p.contains('/me/devices')) p,
  ];

  test('켜면 알림 허락을 묻고 공개 주제를 구독한다 — 로그인 없이', () async {
    setUpPush();

    await push.start();

    expect(messaging.permissionAsked, 1);
    expect(messaging.topics, [publicTopic]);
    expect(devicePaths(), isEmpty);
  });

  test('로그인하면 이 기기 토큰을 등록한다', () async {
    setUpPush();
    await push.start();

    await auth.login(loginId: 'doyeon01', password: 'pw');
    await pumpEventQueue();

    expect(devicePaths(), ['POST /me/devices']);
    final body = fake.requests.last.data as Map;
    expect(body['token'], 'token-1');
    expect(body['platform'], 'ANDROID');
  });

  test('로그인한 채로 켜면 바로 등록한다 (지난 로그인이 살아 있다)', () async {
    setUpPush(
      using: FakeServer(
        (o) async => switch (o.path) {
          '/auth/me' => respond(200, member),
          _ => respond(204),
        },
      ),
    );
    await auth.restore();

    await push.start();
    await pumpEventQueue();

    expect(devicePaths(), ['POST /me/devices']);
  });

  test('로그인 상태가 그대로인 알림(내 정보 다시 받기 등)에는 또 등록하지 않는다', () async {
    setUpPush();
    await push.start();
    await auth.login(loginId: 'doyeon01', password: 'pw');
    await pumpEventQueue();

    await auth.updatePhone('010-0000-0000').catchError((_) {});
    await pumpEventQueue();

    expect(devicePaths(), ['POST /me/devices']);
  });

  test('FCM이 토큰을 바꾸면 새 토큰으로 다시 등록한다 — 로그인했을 때만', () async {
    setUpPush();
    await push.start();

    messaging.refreshes.add('token-before-login');
    await pumpEventQueue();
    expect(devicePaths(), isEmpty);

    await auth.login(loginId: 'doyeon01', password: 'pw');
    await pumpEventQueue();
    messaging.refreshes.add('token-2');
    await pumpEventQueue();

    expect(devicePaths(), ['POST /me/devices', 'POST /me/devices']);
    expect((fake.requests.last.data as Map)['token'], 'token-2');
  });

  test('로그아웃하기 전에 등록을 푼다 — 로그인이 살아 있을 때', () async {
    setUpPush();
    await push.start();
    await auth.login(loginId: 'doyeon01', password: 'pw');
    await pumpEventQueue();

    await auth.logout();

    expect(fake.paths.sublist(fake.paths.length - 2), [
      'DELETE /me/devices/token-1',
      'POST /auth/logout',
    ]);
    expect(auth.isLoggedIn, isFalse);
  });

  test('등록이 실패했으면 로그아웃 때 풀 것도 없다', () async {
    setUpPush(using: server(devicesFail: true));
    await push.start();
    await auth.login(loginId: 'doyeon01', password: 'pw');
    await pumpEventQueue();

    await auth.logout();

    expect(devicePaths(), ['POST /me/devices']);
    expect(auth.isLoggedIn, isFalse);
  });

  test('토큰을 못 받는 기기(구글 플레이 서비스 없음)는 등록을 건너뛴다', () async {
    setUpPush(fakeMessaging: FakePushMessaging(currentToken: null));
    await push.start();

    await auth.login(loginId: 'doyeon01', password: 'pw');
    await pumpEventQueue();

    expect(devicePaths(), isEmpty);
  });

  test('구독이 실패해도 멈추지 않는다 — 알림을 눌러 켠 화면은 그대로 연다', () async {
    setUpPush(
      fakeMessaging: FakePushMessaging(
        initialMessage: payload({'type': 'notice', 'postId': '12'}),
      )..subscribeError = Exception('no play services'),
    );

    await push.start();

    expect(opened, ['/news/12']);
  });

  test('알림을 누르면 그 화면을 연다 · 모르는 종류는 아무것도 하지 않는다', () async {
    setUpPush();
    await push.start();

    messaging.opens
      ..add(payload({'type': 'bulletin', 'bulletinId': '3'}))
      ..add(payload({'type': 'unknown'}));
    await pumpEventQueue();

    expect(opened, ['/bulletin/3']);
  });

  test('앱을 보는 중에 온 알림은 열 화면과 함께 앱에 넘긴다', () async {
    setUpPush();
    await push.start();

    messaging.foregrounds.add(
      payload({'type': 'newcomer'}, title: '새가족 신청', body: '확인해 주세요.'),
    );
    await pumpEventQueue();

    expect(shown, hasLength(1));
    expect(shown.single.$1.title, '새가족 신청');
    expect(shown.single.$2, '/my');
    expect(opened, isEmpty);
  });

  test('dispose하면 로그아웃 전 할 일을 거둔다', () async {
    setUpPush();
    await push.start();
    expect(auth.beforeLogout, isNotNull);

    push.dispose();

    expect(auth.beforeLogout, isNull);
  });

  group('pathFor — 알림 data가 열 화면 (SPEC_API §15.3)', () {
    test('공지 → 그 글, 글 번호가 없으면 소식 목록', () {
      expect(PushService.pathFor({'type': 'notice', 'postId': '5'}), '/news/5');
      expect(PushService.pathFor({'type': 'notice'}), '/news');
    });

    test('주보 → 그 주보, 새가족 → 마이페이지', () {
      expect(
        PushService.pathFor({'type': 'bulletin', 'bulletinId': '9'}),
        '/bulletin/9',
      );
      expect(PushService.pathFor({'type': 'newcomer'}), '/my');
    });

    test('모르는 종류 · 빈 data → null', () {
      expect(PushService.pathFor({'type': 'minutes'}), isNull);
      expect(PushService.pathFor(const {}), isNull);
    });
  });
}
