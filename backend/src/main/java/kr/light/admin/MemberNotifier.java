package kr.light.admin;

import kr.light.member.Member;

/**
 * 회원 상태 변경 알림 (SPEC_API.md §8.2 "안내 메일 발송").
 *
 * <p><b>⚠️ 여기서 실패해도 본 작업은 유지된다.</b> 메일이 안 나갔다고 승인을
 * 되돌리면, 전도사는 이미 "승인했다"고 알고 있는데 서버 상태는 아닌 어긋남이
 * 생긴다. 구현체는 예외를 밖으로 던지지 않고 로그만 남긴다.
 */
public interface MemberNotifier {

    /**
     * 가입이 승인됐음을 본인에게 알린다.
     *
     * <p>⚠️ 구현체는 <b>개인정보를 로그에 남기지 않는다.</b> 이름·이메일이 로그에
     * 쌓이면 회원 명단이 DB 밖에도 존재하게 된다.
     */
    void notifyApproved(Member member);
}
