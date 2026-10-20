import 'package:firebase_messaging/firebase_messaging.dart';

/// 받은 푸시 한 건 — 알림창 글자와, 누르면 열 화면을 정하는 값 (SPEC_API §15.3)
typedef PushPayload = ({
  String? title,
  String? body,
  Map<String, dynamic> data,
});

/// 푸시를 받는 쪽 (기기 · FCM). 테스트는 가짜로 바꿔 끼운다 —
/// Firebase 플러그인은 테스트 환경에서 돌지 않는다
abstract interface class PushMessaging {
  /// 알림을 띄워도 되는지 묻는다 (Android 13+는 사용자에게 창이 뜬다). 허락했으면 true
  Future<bool> requestPermission();

  /// 이 기기의 FCM 토큰. 못 받으면 null (구글 플레이 서비스가 없는 기기 등)
  Future<String?> token();

  /// FCM이 토큰을 바꿨다 — 다시 등록해야 한다
  Stream<String> get tokenRefresh;

  Future<void> subscribe(String topic);

  /// 앱을 보고 있는 중에 온 푸시. 안드로이드는 이때 알림창을 띄우지 않는다 —
  /// 앱이 직접 알려야 한다
  Stream<PushPayload> get foreground;

  /// 알림을 눌러 앱이 앞으로 나왔다 (뒤에 있던 앱)
  Stream<PushPayload> get opened;

  /// 앱이 꺼져 있다가 알림을 눌러 켜졌으면 그 알림
  Future<PushPayload?> initial();
}

/// 실제 FCM (firebase_messaging)
class FirebasePushMessaging implements PushMessaging {
  FirebasePushMessaging([FirebaseMessaging? messaging])
    : _messaging = messaging ?? FirebaseMessaging.instance;

  final FirebaseMessaging _messaging;

  static PushPayload _payload(RemoteMessage m) =>
      (title: m.notification?.title, body: m.notification?.body, data: m.data);

  @override
  Future<bool> requestPermission() async {
    final settings = await _messaging.requestPermission();
    return settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
  }

  // ⚠️ getToken · onTokenRefresh는 firebase_messaging 17에서 「register() ·
  //    onRegistered(설치 ID, FID)를 쓰라」는 지원 중단 예고가 붙었다. 그런데 서버의
  //    Firebase Admin SDK(9.9.0)는 등록 토큰 · 주제로만 보낼 수 있고 FID로 보내는
  //    방법이 없다(Message.Builder에 setToken · setTopic뿐). 그래서 아직은 등록
  //    토큰을 쓴다 — 서버 SDK가 FID를 지원하면 함께 옮긴다 (2026-10-19 확인)

  @override
  // ignore: deprecated_member_use
  Future<String?> token() => _messaging.getToken();

  @override
  // ignore: deprecated_member_use
  Stream<String> get tokenRefresh => _messaging.onTokenRefresh;

  @override
  Future<void> subscribe(String topic) => _messaging.subscribeToTopic(topic);

  @override
  Stream<PushPayload> get foreground =>
      FirebaseMessaging.onMessage.map(_payload);

  @override
  Stream<PushPayload> get opened =>
      FirebaseMessaging.onMessageOpenedApp.map(_payload);

  @override
  Future<PushPayload?> initial() async {
    final message = await _messaging.getInitialMessage();
    return message == null ? null : _payload(message);
  }
}
