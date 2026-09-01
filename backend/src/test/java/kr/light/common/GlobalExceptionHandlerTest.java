package kr.light.common;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import kr.light.post.PostCategory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 예외가 계약된 형태로 나가는지 검증한다.
 *
 * <p>이 테스트가 이 계층의 존재 이유다. FE는 {@code { "error": { code, message,
 * field } }} 하나만 보고 에러 처리를 만들기 때문에, 한 엔드포인트라도 다른
 * 모양으로 응답하면 공통 파서가 깨진다 (SPEC_API.md §1.1, INTEGRATION.md §3.2).
 *
 * <p>Spring Security 필터 체인을 태우지 않는 standalone 구성이다. 어드바이스
 * 자체의 동작만 좁게 본다. 필터 체인에서 나는 401·403은 SecurityConfig가
 * 붙는 M2에서 따로 검증해야 한다.
 */
class GlobalExceptionHandlerTest {

    private final MockMvc mvc = MockMvcBuilders
            .standaloneSetup(new ThrowingController())
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();

    // ── 성공 봉투 ──────────────────────────────────────────────

    @Test
    @DisplayName("성공 응답은 data로 감싼다")
    void 성공_봉투() throws Exception {
        mvc.perform(get("/t/ok"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.value").value("hello"));
    }

    // ── ApiException 매핑 ─────────────────────────────────────

    @Test
    @DisplayName("notFound는 404 NOT_FOUND")
    void 없음() throws Exception {
        mvc.perform(get("/t/not-found"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
    }

    @Test
    @DisplayName("forbidden은 403 FORBIDDEN")
    void 권한부족() throws Exception {
        mvc.perform(get("/t/forbidden"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
    }

    @Test
    @DisplayName("unauthorized는 401 UNAUTHORIZED")
    void 비로그인() throws Exception {
        mvc.perform(get("/t/unauthorized"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("용량 초과는 409 STORAGE_LIMIT")
    void 용량초과() throws Exception {
        mvc.perform(get("/t/storage"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("STORAGE_LIMIT"));
    }

    @Test
    @DisplayName("중복은 409 DUPLICATE이고 field에 필드명이 담긴다")
    void 중복() throws Exception {
        mvc.perform(get("/t/duplicate"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("DUPLICATE"))
                .andExpect(jsonPath("$.error.field").value("email"));
    }

    // ── 검증 오류 ──────────────────────────────────────────────

    @Test
    @DisplayName("@Valid 위반은 400 VALIDATION_ERROR이고 위반 필드명이 담긴다")
    void 본문검증() throws Exception {
        mvc.perform(post("/t/body")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.field").value("name"));
    }

    @Test
    @DisplayName("필수 쿼리 파라미터 누락은 400 VALIDATION_ERROR + 파라미터명")
    void 파라미터누락() throws Exception {
        mvc.perform(get("/t/required-param"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.field").value("category"));
    }

    @Test
    @DisplayName("열거형에 없는 값은 400 VALIDATION_ERROR — 500으로 새지 않는다")
    void 잘못된열거형() throws Exception {
        mvc.perform(get("/t/required-param").param("category", "SECRET"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.field").value("category"));
    }

    @Test
    @DisplayName("JSON이 아닌 본문은 400 VALIDATION_ERROR")
    void 파싱불가() throws Exception {
        mvc.perform(post("/t/body")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{not json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    // ── 권한 · 예상 못한 오류 ───────────────────────────────────

    @Test
    @DisplayName("AccessDeniedException은 403 FORBIDDEN")
    void 접근거부() throws Exception {
        mvc.perform(get("/t/access-denied"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
    }

    @Test
    @DisplayName("예상 못한 예외도 봉투를 유지하고 내부 메시지를 노출하지 않는다")
    void 예상못한오류() throws Exception {
        String body = mvc.perform(get("/t/boom"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error.code").value("INTERNAL_ERROR"))
                .andReturn().getResponse().getContentAsString();

        // 예외 메시지에 DB 정보·SQL이 섞여 있을 수 있다. 그대로 새어나가면 안 된다.
        assertThat(body).doesNotContain(LEAKY_MESSAGE);
    }

    // ── 직렬화 규칙 ────────────────────────────────────────────

    @Test
    @DisplayName("field는 생략하지 않고 null로 명시한다 — FE 옵셔널 처리를 단순하게")
    void field는_null로_명시된다() throws Exception {
        String body = mvc.perform(get("/t/not-found"))
                .andReturn().getResponse().getContentAsString();

        assertThat(body).contains("\"field\":null");
    }

    // ────────────────────────────────────────────────────────────

    private static final String LEAKY_MESSAGE = "내부 접속 정보가 담긴 메시지";

    @RestController
    @RequestMapping("/t")
    static class ThrowingController {

        record Payload(@NotBlank String name) {}

        record Value(String value) {}

        @GetMapping("/ok")
        ApiResponse<Value> ok() {
            return ApiResponse.of(new Value("hello"));
        }

        @GetMapping("/not-found")
        void notFound() {
            throw ApiException.notFound();
        }

        @GetMapping("/forbidden")
        void forbidden() {
            throw ApiException.forbidden();
        }

        @GetMapping("/unauthorized")
        void unauthorized() {
            throw ApiException.unauthorized();
        }

        @GetMapping("/storage")
        void storage() {
            throw ApiException.storageLimit(ErrorCode.STORAGE_LIMIT.defaultMessage());
        }

        @GetMapping("/duplicate")
        void duplicate() {
            throw ApiException.duplicate("email", "이미 사용 중인 이메일입니다.");
        }

        @PostMapping("/body")
        ApiResponse<Void> body(@Valid @RequestBody Payload payload) {
            return ApiResponse.empty();
        }

        @GetMapping("/required-param")
        ApiResponse<Void> requiredParam(@RequestParam PostCategory category) {
            return ApiResponse.empty();
        }

        @GetMapping("/access-denied")
        void accessDenied() {
            throw new AccessDeniedException("denied");
        }

        @GetMapping("/boom")
        void boom() {
            throw new IllegalStateException(LEAKY_MESSAGE);
        }
    }
}
