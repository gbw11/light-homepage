import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../content/location.dart';
import '../core/api/api_client.dart';
import '../core/auth/auth_state.dart';
import '../core/platform/open_url.dart';
import '../core/push/devices_api.dart';
import '../core/push/push_messaging.dart';
import '../core/theme/app_theme.dart';
import '../features/bulletins/bulletins_api.dart';
import '../features/notifications/admin_notifications_api.dart';
import '../features/notifications/inbox.dart';
import '../features/posts/posts_api.dart';
import 'app_intro.dart';
import 'push_snack_bar.dart';
import 'push_service.dart';
import 'router.dart';

class LightApp extends StatefulWidget {
  const LightApp({super.key, required this.api, this.push, this.seenStore});

  final ApiClient api;

  /// 알림함이 "본 알림"을 적어 두는 곳. 없으면 앱 저장소의 파일 (테스트는 메모리)
  final SeenStore? seenStore;

  /// 푸시 알림. Firebase를 켜지 못했거나(테스트 · 구글 플레이 서비스 없음) 없으면
  /// 알림만 빠지고 앱은 그대로다
  final PushMessaging? push;

  @override
  State<LightApp> createState() => _LightAppState();
}

class _LightAppState extends State<LightApp> {
  final _messenger = GlobalKey<ScaffoldMessengerState>();

  /// 앱 전체의 로그인 상태. 켜자마자 지난 로그인을 확인하되 기다리지 않는다
  late final AuthState _auth = AuthState(widget.api)..restore();
  late final StreamSubscription<void> _sessionEnded;

  /// 홈 종 아이콘의 알림함. 로그인한 사람이 바뀌면 스스로 다시 센다
  late final NotificationInbox _inbox = NotificationInbox(
    posts: PostsApi(widget.api),
    bulletins: BulletinsApi(widget.api),
    admin: AdminNotificationsApi(widget.api),
    auth: _auth,
    store: widget.seenStore ?? FileSeenStore(),
  )..refresh();

  /// 앱으로 돌아올 때마다 알림함을 다시 센다 — 그사이 올라온 글이 있을 수 있다
  late final AppLifecycleListener _lifecycle;

  // 라우터는 한 번만 만든다 — build에서 만들면 다시 그릴 때마다 탭 상태가 날아간다
  late final GoRouter _router = buildRouter(
    api: widget.api,
    auth: _auth,
    inbox: _inbox,
    openExternal: _openExternal,
  );

  PushService? _push;

  @override
  void initState() {
    super.initState();
    // 보던 화면은 그대로 두고 알리기만 한다 — 회원 화면은 로그인 상태가 바뀌면
    // 스스로 로그인 안내로 바뀐다
    _sessionEnded = _auth.sessionEnded.listen(
      (_) => _toast('로그인이 만료됐어요. 다시 로그인해 주세요.'),
    );
    _lifecycle = AppLifecycleListener(onResume: _inbox.refresh);
    if (widget.push case final messaging?) {
      _push = PushService(
        messaging: messaging,
        devices: DevicesApi(widget.api),
        auth: _auth,
        onOpen: (path) => _router.push(path),
        onForeground: _showForeground,
      );
      // 첫 화면이 그려진 뒤에 — 알림을 눌러 켠 경우 그 화면을 라우터로 열어야 한다
      WidgetsBinding.instance.addPostFrameCallback((_) => _push?.start());
    }
  }

  /// 앱을 보는 중에 온 알림 — 안드로이드는 알림창을 띄우지 않아 앱이 알린다
  void _showForeground(PushPayload payload, String? path) {
    _inbox.refresh();
    final snackBar = pushSnackBar(
      payload,
      onOpen: path == null ? null : () => _router.push(path),
    );
    if (snackBar == null) return;
    _messenger.currentState
      ?..hideCurrentSnackBar()
      ..showSnackBar(snackBar);
  }

  @override
  void dispose() {
    _push?.dispose();
    _sessionEnded.cancel();
    _lifecycle.dispose();
    _router.dispose();
    _inbox.dispose();
    _auth.dispose();
    super.dispose();
  }

  void _toast(String message) => _messenger.currentState
    ?..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));

  /// YouTube·지도 같은 바깥 주소는 앱 안이 아니라 설치된 앱(없으면 브라우저)으로 연다.
  /// 지도 앱 주소(`kakaomap://` 등)는 앱이 없으면 웹 지도로 다시 연다
  Future<void> _openExternal(String url) async {
    final opened = await openWithFallback(
      url,
      fallbacks: appUrlFallbacks,
      // 열 앱이 없으면 false를 주기도, 예외를 던지기도 한다 (플랫폼마다 다르다)
      launch: (url) => launchUrl(
        Uri.parse(url),
        mode: LaunchMode.externalApplication,
      ).catchError((_) => false),
    );
    if (!opened) _toast('열 수 없어요. 잠시 후 다시 시도해 주세요.');
  }

  @override
  Widget build(BuildContext context) {
    return AuthScope(
      auth: _auth,
      child: InboxScope(
        inbox: _inbox,
        child: MaterialApp.router(
          title: 'LIGHT',
          theme: buildAppTheme(),
          scaffoldMessengerKey: _messenger,
          routerConfig: _router,
          // 달력 · 뒤로가기 툴팁 같은 기본 문구를 한국어로 (주보 날짜 고르기 등)
          locale: const Locale('ko'),
          supportedLocales: const [Locale('ko')],
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          // 앱을 켤 때 인트로를 앱 본체 위에 덮는다 (app_intro.dart). 라우터 밖에 두어
          // 탭·화면 구성과 무관하게 한 번만 뜬다
          builder: (context, child) =>
              AppIntro(child: child ?? const SizedBox.shrink()),
        ),
      ),
    );
  }
}
