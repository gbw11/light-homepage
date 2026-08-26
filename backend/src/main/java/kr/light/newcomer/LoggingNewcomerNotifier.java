package kr.light.newcomer;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 지금의 유일한 구현 — 로그만 남긴다.
 *
 * <p><b>메일 계정과 키가 아직 없어서 발송부를 만들지 않았다.</b> 반만 동작하는
 * HTTP 클라이언트를 넣어 두면 검증할 방법이 없고, 나중에 진짜 붙일 때 오히려
 * 걷어내야 한다. 인터페이스와 호출 시점만 잡아 두고 넘어간다.
 *
 * <p><b>Resend를 붙일 때 할 일</b> (ARCHITECTURE.md §9의 {@code MAIL_API_KEY} ·
 * {@code NOTIFY_EMAIL}):
 * <ol>
 *   <li>{@code ResendNewcomerNotifier}를 만들어 {@link NewcomerNotifier}를 구현한다</li>
 *   <li>둘 중 하나를 고르는 {@code @Configuration}을 두고 이 클래스의
 *       {@code @Component}를 떼어낸다 —
 *       {@code @ConditionalOnExpression("!'${app.mail.api-key:}'.isEmpty()")}로
 *       키가 있을 때만 Resend가 뜨게 한다. {@code @Component}에
 *       {@code @ConditionalOnMissingBean}을 다는 방식은 스캔 순서에 따라
 *       결과가 달라지므로 쓰지 않는다</li>
 *   <li>키가 없는 로컬·CI에서는 여전히 이 구현이 떠야 테스트가 메일을 쏘지 않는다</li>
 * </ol>
 *
 * <p>⚠️ 신청 <b>내용</b>은 찍지 않는다. id만 남긴다. 개인정보가 로그로 새면
 * 보유기간 1년 규칙(SPEC_API.md §8.6)이 DB 밖에서 무너진다.
 */
@Slf4j
@Component
public class LoggingNewcomerNotifier implements NewcomerNotifier {

    @Override
    public void notifyNewcomerRegistered(NewcomerRequest request) {
        log.info("새가족 등록 알림(메일 미발송 — 발송부 미구현): newcomer_requests.id={}",
                request.getId());
    }
}
