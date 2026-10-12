import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

/// 화면 캡처·녹화 막기 (기획안 결정 D3).
///
/// Android의 `FLAG_SECURE`를 켜고 끈다(`MainActivity.kt`). 켜진 동안 스크린샷 ·
/// 화면 녹화 · 최근 앱 미리보기에 화면이 검게 나온다. **다른 기기로 화면을 찍는
/// 것까지는 막지 못한다** — 그래서 서버가 페이지마다 열람자 이름을 박는다
/// (SPEC_API §7.3 워터마크). 화면 문구도 "막았다"고 과장하지 않는다.
///
/// iOS · 테스트처럼 채널이 없는 곳에서는 아무 일도 하지 않는다.
abstract final class ScreenSecurity {
  static const _channel = MethodChannel('kr.light.app/screen_security');

  static Future<void> protect() => _call('protect');
  static Future<void> release() => _call('release');

  static Future<void> _call(String method) async {
    try {
      await _channel.invokeMethod<void>(method);
    } on MissingPluginException {
      // 위 주석
    }
  }
}

/// [child]가 화면에 있는 동안만 캡처를 막는다. 떠나면 풀어 준다 —
/// 다른 화면까지 막히면 공지 캡처처럼 정당한 사용을 막게 된다
class SecureScreen extends StatefulWidget {
  const SecureScreen({super.key, required this.child});

  final Widget child;

  @override
  State<SecureScreen> createState() => _SecureScreenState();
}

class _SecureScreenState extends State<SecureScreen> {
  @override
  void initState() {
    super.initState();
    ScreenSecurity.protect();
  }

  @override
  void dispose() {
    ScreenSecurity.release();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
