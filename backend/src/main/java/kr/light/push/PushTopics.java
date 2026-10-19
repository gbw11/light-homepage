package kr.light.push;

/**
 * FCM 주제(topic). 앱이 직접 구독한다 (SPEC_API.md §15.1).
 *
 * <p>⚠️ 주제는 <b>누구나</b> 구독할 수 있다 — 앱을 거치지 않고도 된다. 그래서 주제로는
 * <b>공개해도 되는 알림만</b> 보낸다(공개 공지 · 주보). 회원 공지 · 새가족 신청은
 * 로그인한 기기 토큰({@link MemberDevice})으로만 보낸다.
 */
public final class PushTopics {

    /** 앱을 설치한 모든 기기 — 로그인과 상관없이 구독한다 */
    public static final String PUBLIC = "public";

    private PushTopics() {
    }
}
