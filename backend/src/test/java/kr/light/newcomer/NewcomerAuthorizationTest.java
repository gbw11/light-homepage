package kr.light.newcomer;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.HashMap;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 인가 매트릭스 — 새가족 (ARCHITECTURE.md §5.3 · SPEC_API.md §10).
 *
 * <p>매트릭스에서 {@code POST /newcomers}는 <b>5개 역할 전부 통과</b>하는 유일한
 * 쓰기 엔드포인트다. 그래서 여기서 지킬 것은 "막히지 않는가" 하나뿐이고,
 * 실제 위험은 <b>이 경로를 열면서 옆의 것까지 열리는 것</b>이다.
 *
 * <p>Jenkinsfile이 {@code --tests "*Authorization*"}으로 이 클래스를 따로 먼저
 * 돌린다 — <b>이름에서 {@code Authorization}을 빼면 CI가 찾지 못한다.</b>
 *
 * <p>인증 수단이 M2라 HTTP로 만들 수 있는 역할은 비로그인(GUEST)뿐이다. 나머지
 * 네 역할도 전부 200이므로, GUEST가 통과하면 상위 역할이 막힐 이유는 없다 —
 * 열어둔 경로에는 역할 조건이 걸려 있지 않기 때문이다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class NewcomerAuthorizationTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @Test
    @DisplayName("POST /api/newcomers는 비로그인으로 통과한다")
    void 등록은_비로그인에게_열려_있다() throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("name", "김도연");
        body.put("phone", "010-1234-5678");
        body.put("agreed", true);

        mockMvc.perform(post("/api/newcomers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Forwarded-For", "198.51.100.1")
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("신청 목록 조회는 열리지 않았다 — 개인정보다")
    void 목록_조회는_막혀_있다() throws Exception {
        // GET /api/admin/newcomers는 LEADER 이상이다 (SPEC_API.md §8.6, M4).
        // 등록 경로를 열면서 이쪽까지 열리면 이름·연락처가 통째로 샌다.
        mockMvc.perform(get("/api/admin/newcomers"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("등록 경로에 다른 메서드는 열려 있지 않다")
    void POST_외의_메서드는_막혀_있다() throws Exception {
        // permitAll을 경로 단위로 걸면 조회·삭제까지 함께 열린다.
        // SecurityConfig가 메서드를 나눠 거는 이유가 이것이다.
        mockMvc.perform(get("/api/newcomers"))
                .andExpect(status().isUnauthorized());
    }
}
