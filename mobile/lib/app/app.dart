import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api/api_client.dart';
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

  // 라우터는 한 번만 만든다 — build에서 만들면 다시 그릴 때마다 탭 상태가 날아간다
  late final GoRouter _router = buildRouter(
    api: widget.api,
    notReady: () => _toast('준비 중인 화면이에요.'),
    openExternal: _openExternal,
  );

  @override
  void dispose() {
    _router.dispose();
    super.dispose();
  }

  void _toast(String message) => _messenger.currentState
    ?..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));

  /// YouTube 같은 바깥 주소는 앱 안이 아니라 설치된 앱(없으면 브라우저)으로 연다
  Future<void> _openExternal(String url) async {
    // 열 앱이 없으면 false를 주기도, 예외를 던지기도 한다 (플랫폼마다 다르다)
    final opened = await launchUrl(
      Uri.parse(url),
      mode: LaunchMode.externalApplication,
    ).catchError((_) => false);
    if (!opened) _toast('영상을 열 수 없어요.');
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'LIGHT',
      theme: buildAppTheme(),
      scaffoldMessengerKey: _messenger,
      routerConfig: _router,
      // 앱을 켤 때 인트로를 앱 본체 위에 덮는다 (app_intro.dart). 라우터 밖에 두어
      // 탭·화면 구성과 무관하게 한 번만 뜬다
      builder: (context, child) =>
          AppIntro(child: child ?? const SizedBox.shrink()),
    );
  }
}
