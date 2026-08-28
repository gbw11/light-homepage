package kr.light.auth;

import kr.light.member.Member;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;

/**
 * 지금의 유일한 구현 — 메일 대신 로그.
 *
 * <p>메일 계정·키가 아직 없어 발송부를 만들지 않았다({@code LoggingMemberNotifier}·
 * {@code LoggingNewcomerNotifier}와 같은 이유). Resend를 붙일 때 세 곳을 함께
 * 바꾸면 된다.
 *
 * <h2>⚠️ 토큰을 로그에 찍는 문제</h2>
 *
 * 메일이 없으면 개발자가 토큰을 얻을 방법이 없다 — 서버는 해시만 갖기 때문이다.
 * 그래서 <b>로컬에서만</b> 평문 토큰을 찍을 수 있게 열어뒀다.
 *
 * <p>다만 이 토큰은 <b>남의 비밀번호를 바꿀 수 있는 값</b>이라 두 겹으로 막는다.
 * <ol>
 *   <li>{@code app.auth.expose-reset-token} 기본값 false — 켜는 것이 의도적이어야 한다</li>
 *   <li>{@code prod} 프로필에서는 <b>플래그가 켜져 있어도 찍지 않는다</b>.
 *       운영 로그는 여러 사람이 보고 수집 도구로도 흘러간다</li>
 * </ol>
 *
 * <p>평소에는 회원 id만 남긴다 — 요청이 실제로 들어왔는지 확인하는 용도다.
 */
@Slf4j
@Component
public class LoggingPasswordResetNotifier implements PasswordResetNotifier {

    private final Environment environment;
    private final boolean exposeToken;

    public LoggingPasswordResetNotifier(
            Environment environment,
            @Value("${app.auth.expose-reset-token:false}") boolean exposeToken) {
        this.environment = environment;
        this.exposeToken = exposeToken;
    }

    @Override
    public void notifyResetRequested(Member member, String rawToken, Duration ttl) {
        if (canExpose()) {
            log.warn("""
                    ⚠️ 개발용 — 재설정 토큰을 로그에 남긴다 (운영에서는 찍지 않는다)
                      members.id = {}
                      token      = {}
                      유효기간    = {}분
                      확인:  POST /api/auth/password/reset  {{"token":"...","password":"..."}}""",
                    member.getId(), rawToken, ttl.toMinutes());
            return;
        }

        log.info("비밀번호 재설정 토큰 발급(메일 미발송 — 발송부 미구현): members.id={}, 유효 {}분",
                member.getId(), ttl.toMinutes());
    }

    /**
     * 평문 토큰을 찍어도 되는 상황인가.
     *
     * <p>prod가 활성 프로필에 하나라도 있으면 플래그와 무관하게 찍지 않는다.
     * {@code local,prod}처럼 둘 다 켠 경우까지 막기 위해서다.
     */
    private boolean canExpose() {
        if (!exposeToken) {
            return false;
        }
        boolean prodActive = List.of(environment.getActiveProfiles()).contains("prod");
        if (prodActive) {
            log.error("app.auth.expose-reset-token이 prod에서 켜져 있다. 토큰을 로그에 남기지 않는다.");
            return false;
        }
        return true;
    }
}
