package kr.light.newcomer;

/**
 * 새가족 등록 알림 (SPEC_API.md §9.1 "성공 시 담당자에게 알림 메일").
 *
 * <p><b>⚠️ 여기서 실패해도 등록은 성공이다.</b> 메일이 안 나갔다고 신청을
 * 되돌리면, 방문하겠다고 마음먹은 사람의 접수가 사라진다. 구현체는 예외를
 * 밖으로 던지지 않고 로그만 남긴다 — 호출부는 {@link NewcomerService} 참고.
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
