import 'package:flutter/material.dart';

import 'core/config.dart';
import 'core/theme/app_theme.dart';

void main() {
  checkConfig();
  registerFontLicenses();
  runApp(const LightApp());
}

class LightApp extends StatelessWidget {
  const LightApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'LIGHT',
      theme: buildAppTheme(),
      home: const Scaffold(body: Center(child: Text('LIGHT'))),
    );
  }
}
