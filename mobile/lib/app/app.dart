import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api/api_client.dart';
import '../core/auth/auth_state.dart';
import '../core/theme/app_theme.dart';
import 'app_intro.dart';
import 'router.dart';

class LightApp extends StatefulWidget {
  const LightApp({super.key, required this.api});

  final ApiClient api;

  @override
  State<LightApp> createState() => _LightAppState();
}

class _LightAppState extends State<LightApp> {
  final _messenger = GlobalKey<ScaffoldMessengerState>();

  /// 앱 전체의 로그인 상태. 켜자마자 지난 로그인을 확인하되 기다리지 않는다
  late final AuthState _auth = AuthState(widget.api)..restore();
  late final StreamSubscription<void> _sessionEnded;

  // 라우터는 한 번만 만든다 — build에서 만들면 다시 그릴 때마다 탭 상태가 날아간다
  late final GoRouter _router = buildRouter(
    api: widget.api,
    auth: _auth,
    openExternal: _openExternal,
  );

  @override
  void initState() {
    super.initState();
    // 보던 화면은 그대로 두고 알리기만 한다 — 회원 화면은 로그인 상태가 바뀌면
    // 스스로 로그인 안내로 바뀐다
    _sessionEnded = _auth.sessionEnded.listen(
      (_) => _toast('로그인이 만료됐어요. 다시 로그인해 주세요.'),
    );
  }

  @override
  void dispose() {
    _sessionEnded.cancel();
    _router.dispose();
    _auth.dispose();
    super.dispose();
  }

  void _toast(String message) => _messenger.currentState
    ?..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));

  /// YouTube·지도 같은 바깥 주소는 앱 안이 아니라 설치된 앱(없으면 브라우저)으로 연다
  Future<void> _openExternal(String url) async {
    // 열 앱이 없으면 false를 주기도, 예외를 던지기도 한다 (플랫폼마다 다르다)
    final opened = await launchUrl(
      Uri.parse(url),
      mode: LaunchMode.externalApplication,
    ).catchError((_) => false);
    if (!opened) _toast('열 수 없어요. 잠시 후 다시 시도해 주세요.');
  }

  @override
  Widget build(BuildContext context) {
    return AuthScope(
      auth: _auth,
      child: MaterialApp.router(
        title: 'LIGHT',
        theme: buildAppTheme(),
        scaffoldMessengerKey: _messenger,
        routerConfig: _router,
        // 앱을 켤 때 인트로를 앱 본체 위에 덮는다 (app_intro.dart). 라우터 밖에 두어
        // 탭·화면 구성과 무관하게 한 번만 뜬다
        builder: (context, child) =>
            AppIntro(child: child ?? const SizedBox.shrink()),
      ),
    );
  }
}
