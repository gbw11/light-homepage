import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'core/api/api_client.dart';
import 'core/config.dart';
import 'core/theme/app_theme.dart';
import 'features/home/home_screen.dart';
import 'features/posts/posts_api.dart';
import 'features/sermons/sermons_api.dart';

Future<void> main() async {
  // ApiClient.create()가 앱 저장소 경로를 묻는다 — 플러그인을 runApp 전에 쓰려면 필요하다
  WidgetsFlutterBinding.ensureInitialized();
  checkConfig();
  registerFontLicenses();
  final api = await ApiClient.create();
  runApp(LightApp(api: api));
}

class LightApp extends StatelessWidget {
  const LightApp({super.key, required this.api});

  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'LIGHT',
      theme: buildAppTheme(),
      scaffoldMessengerKey: _messenger,
      home: HomeScreen(
        posts: PostsApi(api),
        sermons: SermonsApi(api),
        // TODO(mobile): 하단 탭 틀(feat/mobile-tab-shell)에서 각 화면으로 잇는다
        actions: HomeActions(
          onFirstVisit: _notReady,
          onDirections: _notReady,
          onOpenNotice: (_) => _notReady(),
          onSeeAllNotices: _notReady,
          onOpenSermon: (sermon) => _openExternal(sermon.youtubeUrl),
          onSeeAllSermons: _notReady,
        ),
      ),
    );
  }
}

final _messenger = GlobalKey<ScaffoldMessengerState>();

void _toast(String message) => _messenger.currentState
  ?..hideCurrentSnackBar()
  ..showSnackBar(SnackBar(content: Text(message)));

void _notReady() => _toast('준비 중인 화면이에요.');

/// YouTube 같은 바깥 주소는 앱 안이 아니라 설치된 앱(없으면 브라우저)으로 연다
Future<void> _openExternal(String url) async {
  // 열 앱이 없으면 false를 주기도, 예외를 던지기도 한다 (플랫폼마다 다르다)
  final opened = await launchUrl(
    Uri.parse(url),
    mode: LaunchMode.externalApplication,
  ).catchError((_) => false);
  if (!opened) _toast('영상을 열 수 없어요.');
}
