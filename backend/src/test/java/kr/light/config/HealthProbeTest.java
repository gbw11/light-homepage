package kr.light.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.autoconfigure.health.HealthEndpointProperties;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 슬립 방지 핑이 <b>DB를 건드리지 않는지</b> 고정한다.
 *
 * <p>이 테스트가 지키는 것은 기능이 아니라 <b>비용</b>이다.
 * {@code /actuator/health}에는 Spring이 DataSource 인디케이터를 자동으로 붙인다.
 * cron-job.org가 10분마다 그쪽을 때리면 Neon 컴퓨트가 한 번도 자동 정지되지
 * 않아 무료 컴퓨트 한도를 넘고, 그러면 프로젝트 전제("월 $0")가 깨진다
 * (docs/COST_GUARDRAILS.md §3.2).
 *
 * <p>⚠️ <b>이 사고는 조용히 일어난다.</b> 핑이 DB를 깨우고 있어도 화면·API·
 * 테스트는 전부 정상으로 보이고, 청구서나 서비스 정지로만 드러난다. 그래서
 * 사람이 기억하는 대신 테스트로 고정한다.
 *
 * <p>이름에 {@code Authorization}을 넣지 않았다 — 그 이름은 인가 매트릭스
 * (ARCHITECTURE.md §5.3) 것이고 Jenkinsfile이 {@code --tests "*Authorization*"}로
 * 골라 돌린다 (OpenApiDocsTest와 같은 이유).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class HealthProbeTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    HealthEndpointProperties healthProperties;

    @Test
    @DisplayName("핑 그룹(alive)은 ping 인디케이터만 포함한다 — db가 들어가면 실패")
    void aliveGroupContainsOnlyPing() {
        HealthEndpointProperties.Group alive = healthProperties.getGroup().get("alive");

        assertThat(alive)
                .as("alive 그룹이 사라졌다. 슬립 방지 핑이 /actuator/health로 돌아가면 "
                        + "Neon 컴퓨트가 상시 가동된다 (COST_GUARDRAILS.md §3.2)")
                .isNotNull();

        assertThat(alive.getInclude())
                .as("alive 그룹에 외부 의존이 있는 인디케이터가 들어갔다. "
                        + "이 그룹은 10분마다 호출되므로 db·mail·redis 등을 넣으면 "
                        + "그 서비스가 영구히 깨어 있게 된다")
                .containsExactly("ping");
    }

    @Test
    @DisplayName("/actuator/health/alive는 로그인 없이 200 UP")
    void aliveIsPublicAndUp() throws Exception {
        mockMvc.perform(get("/actuator/health/alive"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    @DisplayName("/actuator/health는 진단용으로 계속 열려 있다")
    void fullHealthRemainsAvailable() throws Exception {
        // 핑 대상을 alive로 옮겼을 뿐, 사람이 DB까지 확인할 경로는 남겨둔다.
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }
}
