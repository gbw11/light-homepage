package kr.light.newcomer;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 새가족 공개 폼 (SPEC_API.md §9.1 · FR-PUB-08).
 *
 * <p>인증이 없는 쓰기 엔드포인트라 검사 순서 자체가 방어 장치다. 여기서 보는 것은
 * 세 가지 — 동의 없이는 저장되지 않는가, 봇에게 단서를 주지 않는가, 같은 IP의
 * 반복 제출이 막히는가.
 *
 * <p>⚠️ {@code @Transactional}을 쓰지 않는다. rate limiter가 애플리케이션 메모리에
 * 있어 롤백으로 되돌아가지 않으므로, DB도 롤백에 기대지 않고 직접 비운다. 그래야
 * 두 상태가 어긋나지 않는다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class NewcomerApiTest {

    @Autowired MockMvc mockMvc;
    @Autowired NewcomerRepository repository;
    @Autowired ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        repository.deleteAllInBatch();
    }

    // ── 성공 ──────────────────────────────────────────────────

    @Test
    @DisplayName("비로그인으로 등록되고 접수 ID를 문자열로 돌려준다")
    void 등록_성공() throws Exception {
        mockMvc.perform(submit(form(), "1.1.1.1"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").isString())
                .andExpect(jsonPath("$.data.id").isNotEmpty())
                // 신청 내용을 되돌려주지 않는다 — 공개 엔드포인트가 개인정보를
                // 반사하는 통로가 되면 안 된다
                .andExpect(jsonPath("$.data.name").doesNotExist())
                .andExpect(jsonPath("$.data.phone").doesNotExist());

        assertThat(repository.count()).isEqualTo(1);
        NewcomerRequest saved = repository.findAll().get(0);
        assertThat(saved.getName()).isEqualTo("김도연");
        assertThat(saved.getGender()).isEqualTo(Gender.MALE);
        assertThat(saved.getAgeGroup()).isEqualTo(AgeGroup.EARLY_20S);
        assertThat(saved.getReferrer()).isEqualTo(Referrer.FRIEND);
        // 동의 시각은 서버가 찍는다
        assertThat(saved.getAgreedAt()).isNotNull();
    }

    @Test
    @DisplayName("선택 항목은 비워도 등록된다")
    void 선택항목_생략() throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("name", "김도연");
        body.put("phone", "010-1234-5678");
        body.put("agreed", true);

        mockMvc.perform(submit(body, "1.1.1.2"))
                .andExpect(status().isCreated());

        assertThat(repository.count()).isEqualTo(1);
    }

    // ── 동의 검증 (FR-PUB-08) ─────────────────────────────────

    @Test
    @DisplayName("동의하지 않으면 VALIDATION_ERROR이고 저장되지 않는다")
    void 미동의() throws Exception {
        Map<String, Object> body = form();
        body.put("agreed", false);

        mockMvc.perform(submit(body, "1.1.1.3"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.field").value("agreed"));

        assertThat(repository.count()).isZero();
    }

    @Test
    @DisplayName("agreed를 아예 빼도 거부한다 — 화면을 우회한 직접 호출")
    void 동의_누락() throws Exception {
        Map<String, Object> body = form();
        body.remove("agreed");

        mockMvc.perform(submit(body, "1.1.1.4"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));

        assertThat(repository.count()).isZero();
    }

    @Test
    @DisplayName("이름·연락처가 없으면 400이고 어느 칸인지 알려준다")
    void 필수항목_누락() throws Exception {
        Map<String, Object> body = form();
        body.remove("name");

        mockMvc.perform(submit(body, "1.1.1.5"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.field").value("name"));

        assertThat(repository.count()).isZero();
    }

    // ── 봇 ────────────────────────────────────────────────────

    @Test
    @DisplayName("honeypot에 값이 있으면 204로 조용히 끝나고 저장되지 않는다")
    void honeypot() throws Exception {
        Map<String, Object> body = form();
        body.put("honeypot", "http://spam.example.com");

        mockMvc.perform(submit(body, "1.1.1.6"))
                .andExpect(status().isNoContent())
                // 본문이 없어야 한다. 에러 봉투를 주면 걸렸다는 것을 알게 된다.
                .andExpect(jsonPath("$").doesNotExist());

        assertThat(repository.count()).isZero();
    }

    @Test
    @DisplayName("honeypot이 동의 검증보다 먼저다 — 봇에게는 무엇이 틀렸는지도 알리지 않는다")
    void honeypot이_동의검증보다_먼저() throws Exception {
        Map<String, Object> body = form();
        body.put("honeypot", "spam");
        body.put("agreed", false);

        // 동의 검증이 먼저면 400 VALIDATION_ERROR가 나가 단서를 준다
        mockMvc.perform(submit(body, "1.1.1.7"))
                .andExpect(status().isNoContent());

        assertThat(repository.count()).isZero();
    }

    // ── rate limit (NFR-SEC-26) ───────────────────────────────

    @Test
    @DisplayName("같은 IP는 5분에 5회까지, 6회째는 429 RATE_LIMITED")
    void rate_limit() throws Exception {
        String ip = "203.0.113.9";
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(submit(form(), ip))
                    .andExpect(status().isCreated());
        }

        mockMvc.perform(submit(form(), ip))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error.code").value("RATE_LIMITED"));

        // 6회째는 저장되지 않았다
        assertThat(repository.count()).isEqualTo(5);
    }

    @Test
    @DisplayName("IP가 다르면 서로 영향을 주지 않는다")
    void rate_limit은_IP별이다() throws Exception {
        String blocked = "203.0.113.10";
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(submit(form(), blocked)).andExpect(status().isCreated());
        }
        mockMvc.perform(submit(form(), blocked)).andExpect(status().isTooManyRequests());

        mockMvc.perform(submit(form(), "203.0.113.11"))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("X-Forwarded-For의 맨 앞 값을 쓴다 — Render가 프록시하기 때문")
    void 프록시_뒤_IP() throws Exception {
        // 프록시를 여러 단 거치면 헤더에 값이 쌓인다. 맨 앞이 원래 클라이언트다.
        String chain = "203.0.113.20, 70.41.3.18, 150.172.238.178";
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(submit(form(), chain)).andExpect(status().isCreated());
        }
        mockMvc.perform(submit(form(), chain)).andExpect(status().isTooManyRequests());

        // 앞의 값만 같으면 뒤가 달라도 같은 클라이언트로 센다
        mockMvc.perform(submit(form(), "203.0.113.20, 9.9.9.9"))
                .andExpect(status().isTooManyRequests());
    }

    // ── 보조 ──────────────────────────────────────────────────

    private Map<String, Object> form() {
        Map<String, Object> body = new HashMap<>();
        body.put("name", "김도연");
        body.put("phone", "010-1234-5678");
        body.put("gender", "MALE");
        body.put("ageGroup", "EARLY_20S");
        body.put("referrer", "FRIEND");
        body.put("message", "친구 소개로 가보려고요");
        body.put("agreed", true);
        body.put("honeypot", "");
        return body;
    }

    private MockHttpServletRequestBuilder submit(Map<String, Object> body, String forwardedFor)
            throws Exception {
        return post("/api/newcomers")
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Forwarded-For", forwardedFor)
                .content(objectMapper.writeValueAsString(body));
    }
}
