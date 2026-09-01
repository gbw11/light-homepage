package kr.light.auth;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 명단 대조 시도 제한 (SPEC_API.md §2.1).
 *
 * <h2>무엇을 막는가</h2>
 * 대조는 로그인 없이 누구나 호출할 수 있고, 성공하면 그 사람으로 가입할 수
 * 있다. 제한이 없으면 <b>이름·생년월일·전화번호를 바꿔가며 명단을 통째로
 * 캐낼 수 있다</b> — 교인 명부가 그대로 새는 것과 같다.
 *
 * <h2>⚠️ 초과해도 429를 주지 않는다</h2>
 * 일반 실패와 <b>완전히 같은 401</b>이다 (§9-G 확정). 429나 전용 문구를 주면
 * "지금 막힌 걸 보니 뭔가를 맞히고 있다"는 신호가 되고, 그 자체가 명단을
 * 좁혀가는 단서가 된다.
 *
 * <h2>⚠️ 인스턴스 안의 기억이다</h2>
 * 서버를 재시작하면 카운터가 사라지고, 인스턴스를 늘리면 인스턴스마다 따로
 * 센다. 지금은 Render 단일 인스턴스라 성립한다 — <b>확장하면 공유 저장소로
 * 옮겨야 한다.</b> 그때까지는 이 제한을 "느리게 만드는 장치"로 보고,
 * 유일한 방어선으로 여기지 않는다.
 */
@Component
public class VerifyRosterRateLimiter {

    /** 창 하나의 길이 */
    private static final Duration WINDOW = Duration.ofMinutes(10);

    /**
     * 창 하나에서 허용할 시도 수.
     *
     * <p>사람이 자기 정보를 치다 틀리는 횟수(오타·접미사 착각)로는 넉넉하고,
     * 명단을 훑기에는 턱없이 모자란 값이다.
     */
    private static final int MAX_ATTEMPTS = 10;

    /**
     * 이 크기를 넘으면 만료된 항목을 쓸어낸다.
     *
     * <p>값이 없으면 IP를 바꿔가며 호출하는 것만으로 맵이 무한히 자란다 —
     * 시도 제한이 오히려 메모리 고갈 경로가 된다.
     */
    private static final int SWEEP_THRESHOLD = 10_000;

    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    /**
     * 한 번의 시도를 기록하고, 계속 진행해도 되는지 답한다.
     *
     * <p>성공·실패를 가리지 않고 센다. 성공만 빼주면 맞힐 때마다 예산이
     * 회복되어, 명단을 캐는 쪽에게 제한이 거의 없는 것과 같아진다.
     *
     * @param key 호출자를 구분하는 값 (지금은 클라이언트 IP)
     * @return 허용되면 true
     */
    public boolean tryAcquire(String key, Instant now) {
        if (windows.size() > SWEEP_THRESHOLD) {
            windows.values().removeIf(w -> w.isExpired(now));
        }
        Window window = windows.compute(key, (k, current) ->
                current == null || current.isExpired(now) ? new Window(now) : current);

        return window.increment() <= MAX_ATTEMPTS;
    }

    /** 테스트·재시작 시 초기화 */
    public void reset() {
        windows.clear();
    }

    private static final class Window {
        private final Instant startedAt;
        private int count;

        private Window(Instant startedAt) {
            this.startedAt = startedAt;
        }

        private boolean isExpired(Instant now) {
            return startedAt.plus(WINDOW).isBefore(now);
        }

        private synchronized int increment() {
            return ++count;
        }
    }
}
