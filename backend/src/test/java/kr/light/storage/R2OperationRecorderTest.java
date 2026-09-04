package kr.light.storage;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * R2 연산 횟수 집계 (COST_GUARDRAILS.md §3.6).
 *
 * <p>⚠️ <b>이 카운터는 과금을 막지 않는다.</b> 우리 동작 중 Class A는 업로드뿐이고
 * 월 100만 회는 사실상 도달하지 않는다. 위험한 것은 사용량이 아니라 재시도
 * 루프처럼 회원 수와 무관하게 늘어나는 사고이고, 그것을 청구서가 아니라 로그에서
 * 먼저 보려고 센다.
 *
 * <p>그래서 이 테스트의 무게는 <b>"세는 것이 실제로 세어지는가"</b>에 있다.
 * 동시 업로드에서 증가분이 사라지면 폭주를 감지하지 못한다.
 */
@SpringBootTest
@ActiveProfiles("test")
class R2OperationRecorderTest {

    @Autowired R2OperationRecorder recorder;
    @Autowired R2OperationCounterRepository repository;

    @BeforeEach
    void setUp() {
        repository.deleteAllInBatch();
    }

    @Test
    @DisplayName("등급별로 따로 쌓인다")
    void 등급_분리() {
        recorder.record(R2OperationClass.A, 3);
        recorder.record(R2OperationClass.B, 5);

        assertThat(recorder.countThisMonth(R2OperationClass.A)).isEqualTo(3);
        assertThat(recorder.countThisMonth(R2OperationClass.B)).isEqualTo(5);
    }

    @Test
    @DisplayName("여러 번 기록하면 누적된다 — 덮어쓰지 않는다")
    void 누적() {
        recorder.record(R2OperationClass.A);
        recorder.record(R2OperationClass.A);
        recorder.record(R2OperationClass.A, 8);

        assertThat(recorder.countThisMonth(R2OperationClass.A)).isEqualTo(10);
    }

    @Test
    @DisplayName("★ 동시에 기록해도 증가분이 사라지지 않는다 — 읽고-더하고-쓰면 여기서 깨진다")
    void 동시_기록() throws Exception {
        int threads = 8;
        int perThread = 25;

        ExecutorService pool = Executors.newFixedThreadPool(threads);
        try {
            List<Runnable> tasks = IntStream.range(0, threads)
                    .<Runnable>mapToObj(i -> () -> {
                        for (int n = 0; n < perThread; n++) {
                            recorder.record(R2OperationClass.A);
                        }
                    })
                    .toList();
            tasks.forEach(pool::execute);
            pool.shutdown();
            assertThat(pool.awaitTermination(30, TimeUnit.SECONDS)).isTrue();
        } finally {
            pool.shutdownNow();
        }

        // ON CONFLICT ... SET class_a = class_a + :delta 라 하나도 안 샌다
        assertThat(recorder.countThisMonth(R2OperationClass.A))
                .isEqualTo((long) threads * perThread);
    }

    @Test
    @DisplayName("0이나 음수는 무시한다 — 카운터가 뒤로 가면 폭주를 못 본다")
    void 음수는_무시() {
        recorder.record(R2OperationClass.A, 5);
        recorder.record(R2OperationClass.A, 0);
        recorder.record(R2OperationClass.A, -3);

        assertThat(recorder.countThisMonth(R2OperationClass.A)).isEqualTo(5);
    }

    @Test
    @DisplayName("기록이 없으면 0이다 — 행이 없어도 터지지 않는다")
    void 기록_없음() {
        assertThat(recorder.countThisMonth(R2OperationClass.A)).isZero();
    }

    @Test
    @DisplayName("무료 한도는 Cloudflare 공시값이다 (A 100만 · B 1,000만)")
    void 무료_한도() {
        // 경고 임계 계산의 근거다. 틀리면 경고가 엉뚱한 시점에 뜬다.
        assertThat(R2OperationClass.A.freePerMonth()).isEqualTo(1_000_000L);
        assertThat(R2OperationClass.B.freePerMonth()).isEqualTo(10_000_000L);
    }
}
