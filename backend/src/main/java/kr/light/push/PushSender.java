package kr.light.push;

import java.util.List;

/**
 * 푸시를 실제로 보내는 쪽. 키가 있으면 {@link FcmPushSender}, 없으면
 * {@link NoopPushSender}가 끼워진다 ({@link PushConfig}).
 *
 * <p>테스트는 이 인터페이스를 {@code @MockitoBean}으로 가로채 "무엇을 누구에게
 * 보냈나"를 본다 — FCM을 실제로 부르지 않는다.
 */
public interface PushSender {

    /** 주제를 구독한 모든 기기에 (앱 설치자 전체 — {@link PushTopics#PUBLIC}) */
    void sendToTopic(String topic, PushMessage message);

    /**
     * 기기 토큰들에 보낸다.
     *
     * @return FCM이 "더 이상 없는 기기"라고 답한 토큰들 — 호출한 쪽이 지운다
     *         (앱을 지웠거나 데이터를 지운 기기)
     */
    List<String> sendToTokens(List<String> tokens, PushMessage message);
}
