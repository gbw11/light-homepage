package kr.light.auth;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * 로그인 실패 누적 (SPEC_API.md §2.3).
 *
 * <h2>★ 왜 별도 빈인가 — 트랜잭션 때문이다</h2>
 * 실패를 기록한 직후 {@code AuthService.login}은 예외를 던진다. 기록이 <b>같은
 * 트랜잭션 안</b>에 있으면 그 예외가 트랜잭션을 되돌리면서 <b>방금 센 실패도 함께
 * 사라진다.</b> 그러면 카운터는 영원히 0 근처에 머물고 <b>잠금은 한 번도
 * 동작하지 않는다</b> — 게다가 로그인은 정상적으로 실패하므로 겉으로는 아무
 * 문제가 없어 보인다.
 *
 * <p>그래서 {@link Propagation#REQUIRES_NEW}로 <b>독립된 트랜잭션</b>에서
 * 기록하고 즉시 커밋한다. 자기 호출({@code this.method()})로는 프록시를 타지
 * 않아 적용되지 않으므로 <b>반드시 별도 빈이어야 한다.</b>
 */
@Service
@RequiredArgsConstructor
public class LoginAttemptService {

    private final LoginAttemptRepository repository;

    @Transactional(readOnly = true)
    public boolean isLocked(String loginId, Instant now) {
        return repository.findById(loginId)
                .map(attempt -> attempt.isLocked(now))
                .orElse(false);
    }

    /** ★ 호출자의 트랜잭션과 무관하게 즉시 커밋된다 (위 주석 참고) */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailure(String loginId, Instant now) {
        LoginAttempt attempt = repository.findById(loginId)
                .orElseGet(() -> LoginAttempt.forLoginId(loginId));
        attempt.recordFailure(now);
        repository.save(attempt);
    }

    /** 로그인에 성공하면 누적을 지운다 — 한 번 틀린 사람이 계속 잠기지 않게 */
    @Transactional
    public void reset(String loginId) {
        repository.findById(loginId).ifPresent(attempt -> {
            attempt.reset();
            repository.save(attempt);
        });
    }
}
