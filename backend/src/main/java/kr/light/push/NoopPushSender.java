package kr.light.push;

import lombok.extern.slf4j.Slf4j;

import java.util.List;

/**
 * 서비스 계정 키가 없을 때 — 알림만 건너뛰고 나머지는 그대로 동작한다
 * (로컬 · 테스트 · CI. infra/firebase/README.md §2).
 *
 * <p>무엇을 보냈을지는 로그로 남긴다 — 키 없이도 "언제 알림이 나갔어야 했나"를
 * 확인할 수 있게.
 */
@Slf4j
public class NoopPushSender implements PushSender {

    @Override
    public void sendToTopic(String topic, PushMessage message) {
        log.info("푸시 키 없음 — 건너뜀: topic={} title={}", topic, message.title());
    }

    @Override
    public List<String> sendToTokens(List<String> tokens, PushMessage message) {
        log.info("푸시 키 없음 — 건너뜀: 기기 {}대 title={}", tokens.size(), message.title());
        return List.of();
    }
}
