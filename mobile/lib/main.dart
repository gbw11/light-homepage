import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';

import 'app/app.dart';
import 'core/api/api_client.dart';
import 'core/config.dart';
import 'core/push/push_messaging.dart';
import 'core/theme/app_theme.dart';

Future<void> main() async {
  // ApiClient.create()가 앱 저장소 경로를 묻는다 — 플러그인을 runApp 전에 쓰려면 필요하다
  WidgetsFlutterBinding.ensureInitialized();
  checkConfig();
  registerFontLicenses();
  final api = await ApiClient.create();
  runApp(LightApp(api: api, push: await _startFirebase()));
}

/// 푸시 알림용 Firebase (프로젝트 light-kr-app, `google-services.json`).
/// 켜지 못하면 알림만 빠지고 앱은 그대로 연다 — 알림 때문에 앱이 안 켜지면 안 된다
Future<PushMessaging?> _startFirebase() async {
  try {
    await Firebase.initializeApp();
    return FirebasePushMessaging();
  } catch (error) {
    debugPrint('Firebase를 켜지 못했다 — 푸시 없이 연다: $error');
    return null;
  }
}
