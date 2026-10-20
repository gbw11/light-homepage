package kr.light.push;

import java.util.Map;

/**
 * 앱 푸시 한 건 (SPEC_API.md §15.3).
 *
 * <p>{@code title} · {@code body}는 알림창에 보이는 글자다. {@code body}는 없을 수 있다
 * (null이면 알림창에 제목 한 줄만 보인다). <b>잠금 화면에도 보이므로
 * 개인정보를 넣지 않는다</b> — 새가족 알림에 이름 · 연락처를 싣지 않는 이유다.
 *
 * <p>{@code data}는 앱이 알림을 눌렀을 때 어느 화면을 열지 정하는 값이다
 * ({@code type} + 대상 id). FCM data는 문자열 값만 받는다.
 */
public record PushMessage(String title, String body, Map<String, String> data) {

    public PushMessage {
        data = Map.copyOf(data);
    }
}
