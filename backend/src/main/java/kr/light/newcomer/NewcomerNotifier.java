package kr.light.newcomer;

/**
 * 새가족 등록 알림 (SPEC_API.md §9.1 "성공 시 담당자에게 알림 메일").
 *
 * <p><b>⚠️ 여기서 실패해도 등록은 성공이다.</b> 메일이 안 나갔다고 신청을
 * 되돌리면, 방문하겠다고 마음먹은 사람의 접수가 사라진다. 구현체는 예외를
 * 밖으로 던지지 않고 로그만 남긴다 — 호출부는 {@link NewcomerService} 참고.
 *
 * <p><b>★ 전도사·임원에게 실제로 알리는 것은 이 인터페이스가 아니다.</b>
 * 웹 알림(§14)은 밀어주는 방식이 아니라 {@code newcomer_requests}를 읽어
 * 계산하는 방식이라, 이 경로를 타지 않는다 —
 * {@code kr.light.notification.NotificationService} 참고.
 *
 * <p>그래서 이 인터페이스는 <b>메일이 붙을 자리로만 남아 있다.</b> 발신
 * 도메인이 정해지면 여기에 구현체를 끼우면 되고, 그때까지 알림이 아예
 * 없는 상태는 §14가 메운다.
 */
public interface NewcomerNotifier {

    /**
     * 담당자에게 새 신청을 알린다.
     *
     * <p>⚠️ 구현체는 <b>개인정보를 로그에 남기지 않는다.</b> 연락처·이름이 로그에
     * 쌓이면 보유기간 1년 규칙(SPEC_API.md §8.6)이 DB 밖에서 무너진다.
     */
    void notifyNewcomerRegistered(NewcomerRequest request);
}
