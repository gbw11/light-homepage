package kr.light.config;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.EnumerablePropertySource;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 커넥션 풀이 <b>Neon을 상시 가동시키지 않는지</b> 고정한다.
 *
 * <p>{@link HealthProbeTest}와 같은 성격의 장치다 — 지키는 것이 기능이 아니라
 * <b>비용</b>이고, <b>깨져도 아무 증상이 없다.</b>
 *
 * <p>{@code COST_GUARDRAILS.md §3.2}는 슬립 방지 핑을 {@code /actuator/health/alive}로
 * 옮겨 "핑이 DB를 깨우는" 누수를 막았다. 그런데 <b>커넥션 풀이 같은 누수를 다시
 * 만들 수 있다</b>:
 *
 * <ul>
 *   <li>HikariCP 6.3.3의 {@code keepaliveTime} 기본값은 0이 아니라 <b>2분</b>이다
 *       ({@code DEFAULT_KEEPALIVE_TIME}). 유휴 커넥션에 2분마다 쿼리를 보내므로
 *       Neon의 유휴 타이머가 계속 초기화되고, <b>컴퓨트가 한 번도 정지하지 않는다.</b></li>
 *   <li>{@code minimumIdle} 기본값은 {@code maximumPoolSize}와 같다(음수 →
 *       maxPoolSize로 보정). 즉 풀이 <b>고정 크기</b>로 동작해 커넥션 3개가
 *       영구히 남고, {@code idleTimeout}은 "fixed size pool이라 효과 없음" 경고와
 *       함께 무시된다.</li>
 * </ul>
 *
 * <p>둘이 겹치면 <b>서버가 깨어 있는 동안(06:00~24:00, 월 558시간) Neon도 계속
 * 깨어 있다.</b> Neon 무료 컴퓨트 한도는 그보다 훨씬 작다.
 *
 * <p><b>왜 {@code @SpringBootTest}가 아닌가</b> — 두 가지 이유다.
 * <ol>
 *   <li>이 검증에는 <b>DB가 필요 없다.</b> Postgres 없이도 돌아야 이 가드가
 *       가장 필요한 상황(로컬·간단한 점검)에서 실제로 돌아간다.</li>
 *   <li>바인딩된 결과만 보면 <b>활성 프로필 하나</b>만 확인된다. 여기서는
 *       {@code application.yml}의 <b>모든 문서</b>(default·prod)를 훑어서
 *       "prod 문서가 나중에 keepalive를 되살리는" 경우까지 막는다.</li>
 * </ol>
 */
class DataSourcePoolConfigTest {

    private static final String HIKARI = "spring.datasource.hikari.";

    /** {@code application.yml}의 문서들. 0번이 공통, 그 뒤가 프로필별 문서다. */
    private static List<PropertySource<?>> documents;

    @BeforeAll
    static void loadYamlDocuments() throws IOException {
        documents = new YamlPropertySourceLoader()
                .load("application.yml", new ClassPathResource("application.yml"));

        assertThat(documents)
                .as("application.yml을 멀티 문서 YAML로 읽지 못했다")
                .isNotEmpty();
    }

    @Test
    @DisplayName("★ keepalive-time은 0이어야 한다 — 켜지면 Neon이 상시 가동된다")
    void keepaliveMustBeDisabled() {
        assertThat(value(HIKARI + "keepalive-time"))
                .as("커넥션 유지 핑이 켜져 있다(기본값 2분). 유휴 커넥션에 주기적으로 "
                        + "쿼리를 보내면 Neon 컴퓨트가 자동 정지하지 않아 무료 한도를 "
                        + "넘긴다 — /actuator/health/alive로 막은 누수를 풀이 다시 "
                        + "만드는 셈이다 (COST_GUARDRAILS.md §3.2)")
                .isEqualTo("0");
    }

    @Test
    @DisplayName("★ minimum-idle은 0이어야 한다 — 기본값이면 풀이 고정 크기가 되어 안 비워진다")
    void minimumIdleMustBeZero() {
        assertThat(value(HIKARI + "minimum-idle"))
                .as("minimum-idle이 없거나 0이 아니다. 기본값은 maximum-pool-size와 "
                        + "같아서 풀이 고정 크기로 동작하고, 그러면 idle-timeout이 "
                        + "무시되어 커넥션이 영구히 남는다")
                .isEqualTo("0");
    }

    @Test
    @DisplayName("idle-timeout은 Neon 자동 정지(약 5분)보다 먼저 걸려야 한다")
    void idleTimeoutMustExpireBeforeNeonSuspends() {
        long idleTimeout = Long.parseLong(value(HIKARI + "idle-timeout"));

        // HikariCP는 10초 미만이면 기본값(10분)으로 되돌린다.
        assertThat(idleTimeout)
                .as("idle-timeout이 10초 미만이면 HikariCP가 기본값 10분으로 되돌린다")
                .isGreaterThanOrEqualTo(10_000L);

        // Neon 자동 정지는 약 5분이다. 그보다 늦게 비우면 죽은 커넥션이 풀에 남는다.
        assertThat(idleTimeout)
                .as("idle-timeout이 Neon 자동 정지(약 5분)보다 늦다. 그러면 정지 후에 "
                        + "죽은 커넥션이 풀에 남아, 실제 사용자 요청의 첫 쿼리가 "
                        + "검증 실패 → 폐기 → 재연결을 거치며 느려진다")
                .isLessThan(300_000L);
    }

    @Test
    @DisplayName("maximum-pool-size는 Neon 연결 수 한도 안에 있어야 한다 (3~5)")
    void poolSizeStaysWithinNeonLimit() {
        int maxPoolSize = Integer.parseInt(value(HIKARI + "maximum-pool-size"));

        assertThat(maxPoolSize)
                .as("Neon 무료 티어는 연결 수 제한이 있다. 기본값 10이면 연결이 "
                        + "고갈된다 (ARCHITECTURE.md §8.2 — 3~5)")
                .isBetween(1, 5);
    }

    @Test
    @DisplayName("풀 설정은 공통 문서에만 있다 — 프로필 문서가 되살릴 수 없게")
    void profileDocumentsMustNotRedefinePoolSettings() {
        List<String> redefined = new ArrayList<>();

        for (int i = 1; i < documents.size(); i++) {
            PropertySource<?> document = documents.get(i);
            if (!(document instanceof EnumerablePropertySource<?> enumerable)) {
                continue;
            }
            for (String name : enumerable.getPropertyNames()) {
                if (name.startsWith(HIKARI)) {
                    redefined.add("문서#" + i + " → " + name);
                }
            }
        }

        assertThat(redefined)
                .as("프로필 문서(prod 등)가 커넥션 풀 설정을 다시 정의했다. "
                        + "위 테스트들은 공통 문서만 보므로, 여기서 덮어쓰면 "
                        + "가드를 통과하면서 운영에서만 누수가 생긴다")
                .isEmpty();
    }

    /** 공통 문서(0번)에서 값을 문자열로 꺼낸다. 없으면 그 자리에서 실패한다. */
    private static String value(String key) {
        Object raw = documents.get(0).getProperty(key);

        assertThat(raw)
                .as("application.yml 공통 문서에 %s 가 없다", key)
                .isNotNull();

        return String.valueOf(raw);
    }
}
