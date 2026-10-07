import 'package:flutter/material.dart';

import 'app/app.dart';
import 'core/api/api_client.dart';
import 'core/config.dart';
import 'core/theme/app_theme.dart';

Future<void> main() async {
  // ApiClient.create()가 앱 저장소 경로를 묻는다 — 플러그인을 runApp 전에 쓰려면 필요하다
  WidgetsFlutterBinding.ensureInitialized();
  checkConfig();
  registerFontLicenses();
  final api = await ApiClient.create();
  runApp(LightApp(api: api));
}
