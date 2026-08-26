package kr.light.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 계약서가 실제로 열려 있는지 검증한다.
 *
 * <p>DoD가 "FE가 Swagger UI로 확인 가능"(BACKEND_TASKS.md §10 M1)이므로,
 * <b>로그인 없이</b> 열리는지가 핵심이다. Security 설정을 건드리다 이 경로가
 * 다시 막히면 FE가 계약서를 못 보는데, 그 사실은 FE가 알려주기 전까지
 * 드러나지 않는다.
 *
 * <p>⚠️ 이름에 {@code Authorization}을 넣지 않았다. 그 이름은 인가 매트릭스
 * 테스트(ARCHITECTURE.md §5.3)의 것이고 Jenkinsfile이
 * {@code --tests "*Authorization*"}로 항상 골라 돌린다. 여기는 그 매트릭스가
 * 아니므로 섞지 않는다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OpenApiDocsTest {

    @Autowired
    MockMvc mockMvc;

    @Test
    @DisplayName("api-docs는 로그인 없이 열린다")
    void apiDocsIsPublic() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.info.title").value("LIGHT API"))
                .andExpect(jsonPath("$.info.version").value("v1"));
    }

    @Test
    @DisplayName("Swagger UI 경로가 로그인 없이 열린다")
    void swaggerUiIsPublic() throws Exception {
        // springdoc이 /swagger-ui/index.html로 리다이렉트한다. 401이 아니면 된다.
        mockMvc.perform(get("/swagger-ui.html"))
                .andExpect(status().is3xxRedirection());

        mockMvc.perform(get("/swagger-ui/index.html"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("에러 봉투 스키마가 문서에 들어 있다")
    void errorEnvelopeIsDocumented() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                // FE는 컨트롤러가 생기기 전에도 실패 응답의 형태를 볼 수 있어야 한다
                .andExpect(jsonPath("$.components.schemas.ErrorResponse").exists())
                // 기본값이면 "Body"라는 일반적인 이름이 된다. 계약서에 그 이름을
                // 내보내지 않기로 했으므로 고정돼 있는지 본다.
                .andExpect(jsonPath("$.components.schemas.ErrorBody").exists())
                .andExpect(jsonPath("$.components.schemas.Body").doesNotExist())
                .andExpect(jsonPath("$.components.responses.FORBIDDEN").exists())
                .andExpect(jsonPath("$.components.responses.VALIDATION_ERROR").exists());
    }

    @Test
    @DisplayName("Render 슬립 방지 핑 경로는 열려 있다")
    void healthIsPublic() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("보호 경로의 401도 계약된 봉투로 나간다")
    void unauthenticatedRequestUsesErrorEnvelope() throws Exception {
        // 필터 체인이 내보내는 401이라 GlobalExceptionHandler를 거치지 않는다.
        // 여기서 형태가 어긋나면 FE의 공통 에러 파서가 깨진다 (SPEC_API.md §1.1).
        mockMvc.perform(get("/api/some-protected-thing"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.error.message").exists())
                // field는 생략하지 않고 null로 있어야 한다 (SPEC_API.md §1.3).
                // JSONAssert는 키가 아예 없으면 실패시킨다.
                .andExpect(content().json("{\"error\":{\"field\":null}}"));
    }
}
