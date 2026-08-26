package kr.light.common;

import lombok.extern.slf4j.Slf4j;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 키(보통 IP)별 슬라이딩 윈도 요청 제한.
 *
 * <p><b>메모리에만 있다.</b> Redis를 쓰지 않는 이유는 비용 $0 제약 때문이고
 * (ARCHITECTURE.md §8), 인스턴스가 하나뿐이라 지금은 그것으로 충분하다.
 *
 * <p><b>⚠️ 한계를 알고 쓸 것.</b>
 * <ul>
 *   <li>재시작하면 카운터가 사라진다. Render 무료 티어는 15분 유휴 시 잠들므로
 *       실제로 자주 초기화된다. 스팸을 <b>줄이는</b> 장치이지 막는 장치가 아니다.</li>
 *   <li>인스턴스를 늘리면 각자 따로 센다. 그때는 공유 저장소가 필요하다.</li>
 * </ul>
 *
 * <p>제한이 실제로 필요한 곳(새가족 공개 폼)에만 쓴다.
 */
@Slf4j
public class SlidingWindowRateLimiter {

    private final int maxRequests;
    private final Duration window;

    /**
     * 키별 요청 시각. 윈도를 벗어난 것은 조회 때마다 버린다.
     *
     * <p>Deque는 키마다 별도 락으로 보호한다 — {@code ConcurrentHashMap}은 맵
     * 자체만 안전하고 값으로 담긴 Deque는 안전하지 않다.
     */
    private final Map<String, Deque<Instant>> hits = new ConcurrentHashMap<>();

    /** 이 수를 넘으면 오래된 키를 청소한다. 봇이 IP를 바꿔가며 때리면 맵이 계속 자란다. */
    private static final int CLEANUP_THRESHOLD = 10_000;

    public SlidingWindowRateLimiter(int maxRequests, Duration window) {
        this.maxRequests = maxRequests;
        this.window = window;
    }

    /**
     * 이번 요청을 허용할지 판단하고, 허용이면 기록한다.
     *
     * @return 허용이면 true, 한도를 넘었으면 false
     */
    public boolean tryAcquire(String key, Instant now) {
        if (hits.size() > CLEANUP_THRESHOLD) {
            evictExpired(now);
        }
        Deque<Instant> timestamps = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (timestamps) {
            Instant cutoff = now.minus(window);
            while (!timestamps.isEmpty() && !timestamps.peekFirst().isAfter(cutoff)) {
                timestamps.pollFirst();
            }
            if (timestamps.size() >= maxRequests) {
                return false;
            }
            timestamps.addLast(now);
            return true;
        }
    }

    /** 윈도를 완전히 벗어난 키를 통째로 버린다 */
    private void evictExpired(Instant now) {
        Instant cutoff = now.minus(window);
        hits.entrySet().removeIf(entry -> {
            Deque<Instant> timestamps = entry.getValue();
            synchronized (timestamps) {
                return timestamps.isEmpty() || !timestamps.peekLast().isAfter(cutoff);
            }
        });
        log.debug("rate limiter 청소 후 키 {}개", hits.size());
    }
}
