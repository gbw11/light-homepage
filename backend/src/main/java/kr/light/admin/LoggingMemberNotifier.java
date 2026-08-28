package kr.light.admin;

import kr.light.member.Member;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 지금의 유일한 구현 — 로그만 남긴다.
 *
 * <p>메일 계정·키가 아직 없다. 검증할 수 없는 HTTP 클라이언트를 넣으면 나중에
 * 진짜 붙일 때 걷어내야 하므로, 인터페이스와 호출 시점만 잡아 둔다.
 * 새가족 쪽({@code LoggingNewcomerNotifier})과 같은 방식이고, Resend를 붙일 때
 * 두 곳을 함께 바꾸면 된다.
 *
 * <p>⚠️ id만 남긴다. 이름·이메일은 찍지 않는다.
 */
@Slf4j
@Component
public class LoggingMemberNotifier implements MemberNotifier {

    @Override
    public void notifyApproved(Member member) {
        log.info("가입 승인 알림(메일 미발송 — 발송부 미구현): members.id={}", member.getId());
    }
}
