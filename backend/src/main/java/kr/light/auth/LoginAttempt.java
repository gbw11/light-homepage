package kr.light.auth;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Duration;
import java.time.Instant;

/**
 * 아이디별 로그인 실패 누적 (SPEC_API.md §2.3 — 5회 실패 → 15분 잠금).
 *
 * <h2>⚠️ 잠겼다는 사실을 응답으로 알려주지 않는다</h2>
 * 일반 실패와 <b>같은 401</b>이다 (§9-G). "이 아이디는 잠겼습니다"는 곧
 * "이 아이디는 존재합니다"라서, 알려주는 순간 아이디 목록을 만들 수 있다.
 *
 * <h2>왜 IP가 아니라 아이디 단위인가</h2>
 * 교회는 공용 와이파이를 쓴다. IP로 세면 한 사람이 다섯 번 틀렸을 때
 * <b>그 자리의 모두가 잠긴다.</b> 반대로 공격하는 쪽은 IP를 바꾸면 그만이라,
 * 불편만 크고 방어는 약한 조합이다.
 *
 * <p>대신 아이디 단위는 <b>남의 아이디를 일부러 잠글 수 있다</b>는 약점이
 * 있다(계정 잠금 공격). 15분으로 짧게 잡은 이유이고, 그래서 이 값을 더
 * 늘리지 않는다.
 */
@Entity
@Table(name = "login_attempts")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class LoginAttempt {

    /** 5회째 실패에서 잠근다 (§2.3) */
    public static final int MAX_FAILURES = 5;

    /** 잠금 시간 (§2.3) */
    public static final Duration LOCK_DURATION = Duration.ofMinutes(15);

    @Id
    @Column(name = "login_id", length = 30)
    private String loginId;

    @Column(name = "failure_count", nullable = false)
    private int failureCount;

    @Column(name = "locked_until")
    private Instant lockedUntil;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public static LoginAttempt forLoginId(String loginId) {
        LoginAttempt attempt = new LoginAttempt();
        attempt.loginId = loginId;
        return attempt;
    }

    public boolean isLocked(Instant now) {
        return lockedUntil != null && lockedUntil.isAfter(now);
    }

    /**
     * 실패를 한 번 기록한다.
     *
     * <p>잠금이 이미 풀린 뒤의 첫 실패는 1부터 다시 센다 — 이어서 세면
     * 한 번 잠긴 계정이 그 뒤로 실패 한 번에 계속 잠긴다.
     */
    public void recordFailure(Instant now) {
        if (lockedUntil != null && !lockedUntil.isAfter(now)) {
            failureCount = 0;
            lockedUntil = null;
        }
        failureCount++;
        if (failureCount >= MAX_FAILURES) {
            lockedUntil = now.plus(LOCK_DURATION);
        }
    }

    /** 로그인에 성공하면 누적을 지운다 */
    public void reset() {
        failureCount = 0;
        lockedUntil = null;
    }
}
