import 'dart:async';

import '../core/auth/auth_state.dart';
import '../core/push/devices_api.dart';
import '../core/push/push_messaging.dart';
import 'paths.dart';

/// 앱 설치자 전체가 구독하는 주제 — 공개 공지 · 주보 (SPEC_API §15.1).
/// 로그인과 상관없이 구독한다
const publicTopic = 'public';

/// 앱 푸시 알림 (SPEC_API §15, 2026-10-19).
///
/// - 켤 때: 알림 허락을 묻고 주제 [publicTopic]을 구독한다
/// - 로그인하면: 이 기기 토큰을 서버에 등록한다 (회원 공지 · 새가족 신청용).
///   FCM이 토큰을 바꾸면 다시 등록한다
/// - 로그아웃하기 **전에**: 등록을 푼다 — 뒤에는 로그인이 없어 서버가 받지 않는다.
///   풀지 않으면 다음 사람이 이 폰을 쓸 때까지 앞 사람의 회원 알림이 계속 온다
/// - 알림을 누르면 [onOpen]으로 그 화면을 연다. 앱을 보는 중에 오면 [onForeground]
///
/// 알림은 덤이다 — 어느 단계가 실패해도(권한 거절 · 구글 플레이 서비스 없음 · 서버
/// 오류) 앱의 다른 동작을 막지 않는다.
class PushService {
  PushService({
    required this.messaging,
    required this.devices,
    required this.auth,
    required this.onOpen,
    required this.onForeground,
  });

  final PushMessaging messaging;
  final DevicesApi devices;
  final AuthState auth;

  /// 알림을 눌렀다 — 이 주소의 화면을 연다
  final void Function(String path) onOpen;

  /// 앱을 보는 중에 왔다. [path]는 누르면 열 화면(없으면 null)
  final void Function(PushPayload payload, String? path) onForeground;

  final _subscriptions = <StreamSubscription<Object?>>[];
  var _wasLoggedIn = false;

  /// 서버에 등록해 둔 토큰 — 로그아웃 때 이것을 푼다
  String? _registered;

  /// 알림이 열 화면 (SPEC_API §15.3 `data`). 모르는 종류면 null
  static String? pathFor(Map<String, dynamic> data) =>
      switch ((data['type'], data['postId'], data['bulletinId'])) {
        ('notice', final String postId, _) => '${AppPaths.news}/$postId',
        ('notice', _, _) => AppPaths.news,
        ('bulletin', _, final String bulletinId) =>
          '${AppPaths.bulletin}/$bulletinId',
        // 앱에는 새가족 목록이 없다 — 마이페이지의 「관리 화면(웹)」으로 간다
        ('newcomer', _, _) => AppPaths.my,
        _ => null,
      };

  Future<void> start() async {
    auth.beforeLogout = _unregister;
    auth.addListener(_onAuthChanged);
    _subscriptions
      ..add(messaging.tokenRefresh.listen((token) => _register(token)))
      ..add(
        messaging.foreground.listen((p) => onForeground(p, pathFor(p.data))),
      )
      ..add(messaging.opened.listen(_open));

    await _quietly(() async {
      await messaging.requestPermission();
      await messaging.subscribe(publicTopic);
    });
    final initial = await _quietly(messaging.initial);
    if (initial != null) _open(initial);
    _onAuthChanged();
  }

  void _open(PushPayload payload) {
    if (pathFor(payload.data) case final path?) onOpen(path);
  }

  /// 로그인한 순간에만 등록한다 — 내 정보를 다시 받는 것처럼 로그인 상태가 그대로인
  /// 알림에는 반응하지 않는다
  void _onAuthChanged() {
    final loggedIn = auth.isLoggedIn;
    if (loggedIn && !_wasLoggedIn) _register(null);
    _wasLoggedIn = loggedIn;
  }

  Future<void> _register(String? refreshed) async {
    if (!auth.isLoggedIn) return;
    await _quietly(() async {
      final token = refreshed ?? await messaging.token();
      if (token == null) return;
      await devices.register(token);
      _registered = token;
    });
  }

  Future<void> _unregister() async {
    final token = _registered;
    if (token == null) return;
    _registered = null;
    await _quietly(() => devices.unregister(token));
  }

  /// 알림 때문에 앱이 멈추거나 오류가 나면 안 된다
  static Future<T?> _quietly<T>(Future<T> Function() action) async {
    try {
      return await action();
    } catch (_) {
      return null;
    }
  }

  void dispose() {
    for (final s in _subscriptions) {
      s.cancel();
    }
    auth.removeListener(_onAuthChanged);
    if (auth.beforeLogout == _unregister) auth.beforeLogout = null;
  }
}
