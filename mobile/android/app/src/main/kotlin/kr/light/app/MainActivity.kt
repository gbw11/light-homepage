package kr.light.app

import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        // 화면 캡처·녹화 막기 (기획안 결정 D3 — 월례회 뷰어).
        // FLAG_SECURE가 켜진 동안에는 스크린샷·화면 녹화·최근 앱 미리보기에
        // 이 창이 검게 나온다. 다른 기기로 화면을 찍는 것까지는 막지 못한다.
        // Dart 쪽: lib/core/platform/screen_security.dart
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "kr.light.app/screen_security")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "protect" -> {
                        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
                        result.success(null)
                    }
                    "release" -> {
                        window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            }
    }
}
