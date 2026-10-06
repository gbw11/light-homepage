import 'package:flutter/material.dart';

void main() {
  runApp(const LightApp());
}

class LightApp extends StatelessWidget {
  const LightApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'LIGHT',
      theme: ThemeData(colorSchemeSeed: Colors.green),
      home: const Scaffold(body: Center(child: Text('LIGHT'))),
    );
  }
}
