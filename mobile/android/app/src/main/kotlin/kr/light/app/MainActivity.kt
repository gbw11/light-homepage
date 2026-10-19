package kr.light.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createNoticeChannel()
    }

    // 푸시 알림 채널 (SPEC_API §15.3). 서버가 이 채널로 보낸다 — Android 8+는 채널이
    // 없으면 알림이 뜨지 않는다. 이미 있으면 아무 일도 하지 않는다(이름 · 중요도는
    // 사용자가 설정에서 바꾼 값이 남는다). 값은 서버 FcmPushSender.ANDROID_CHANNEL_ID와 같다
    private fun createNoticeChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            "light_notices",
            "공지 · 주보 알림",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply { description = "새 공지 · 주보 · 새가족 신청을 알려요" }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

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
