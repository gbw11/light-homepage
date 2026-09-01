package kr.light.config;

import kr.light.auth.AuthPrincipal;
import kr.light.member.Role;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.stream.Stream;

import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 인가 매트릭스 — {@code @PreAuthorize}와 역할 계층이 실제로 걸리는가
 * (ARCHITECTURE.md §5.2 2층 · §5.1 역할 계층).
 *
 * <p>Jenkinsfile이 {@code --tests "*Authorization*"}으로 골라 돌린다 —
 * <b>이름에서 {@code Authorization}을 빼면 CI가 찾지 못한다.</b>
 *
 * <p><b>왜 테스트용 컨트롤러를 따로 두는가.</b> 지금 실제 보호 엔드포인트는
 * {@code GET /api/auth/me} 하나뿐이라, 실제 컨트롤러만으로는 역할별 표를
 * 만들 수 없다. 그런데 검증해야 하는 것은 개별 엔드포인트가 아니라
 * <b>메서드 보안 설정 자체</b>다 — 계층이 걸렸는지,
 * 거부될 때 어떤 에러 코드가 나가는지. 그 설정이 깨지면 앞으로 추가될
 * 모든 회원 API가 한꺼번에 뚫린다.
 *
 * <p>M2의 남은 항목들이 실제 엔드포인트를 만들면 그 행을 여기에 추가한다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MethodSecurityAuthorizationTest {

    @Autowired MockMvc mockMvc;

    /** 실제 엔드포인트가 아니라 설정을 검증하기 위한 표본 */
    @TestConfiguration
    static class ProbeConfig {
        @Bean
        ProbeController probeController() {
            return new ProbeController();
        }
    }

    @RestController
    @RequestMapping("/probe")
    static class ProbeController {

        @PreAuthorize("isAuthenticated()")
        @GetMapping("/authenticated")
        String authenticated() {
            return "ok";
        }

        @PreAuthorize("hasRole('MEMBER')")
        @GetMapping("/member")
        String member() {
            return "ok";
        }

        @PreAuthorize("hasRole('LEADER')")
        @GetMapping("/leader")
        String leader() {
            return "ok";
        }

        @PreAuthorize("hasRole('PASTOR')")
        @GetMapping("/pastor")
        String pastor() {
            return "ok";
        }
    }

    // ── 역할 × 요구권한 매트릭스 ────────────────────────────────

    /**
     * {@code null} 역할은 비로그인이다.
     *
     * <p>기대 상태: 200 통과 · 401 미인증 · 403 권한 부족.
     */
    static Stream<Arguments> matrix() {
        return Stream.of(
                // 경로,             역할,          기대 상태, 기대 에러코드
                arguments("/probe/authenticated", null,         401, "UNAUTHORIZED"),
                arguments("/probe/authenticated", Role.MEMBER,  200, null),
                arguments("/probe/authenticated", Role.LEADER,  200, null),
                arguments("/probe/authenticated", Role.PASTOR,  200, null),

                arguments("/probe/member", null,         401, "UNAUTHORIZED"),
                arguments("/probe/member", Role.MEMBER,  200, null),
                arguments("/probe/member", Role.LEADER,  200, null),   // 계층
                arguments("/probe/member", Role.PASTOR,  200, null),   // 계층

                arguments("/probe/leader", null,         401, "UNAUTHORIZED"),
                arguments("/probe/leader", Role.MEMBER,  403, "FORBIDDEN"),
                arguments("/probe/leader", Role.LEADER,  200, null),
                arguments("/probe/leader", Role.PASTOR,  200, null),   // 계층

                arguments("/probe/pastor", null,         401, "UNAUTHORIZED"),
                arguments("/probe/pastor", Role.MEMBER,  403, "FORBIDDEN"),
                arguments("/probe/pastor", Role.LEADER,  403, "FORBIDDEN"),
                arguments("/probe/pastor", Role.PASTOR,  200, null)
        );
    }

    @ParameterizedTest(name = "{0} × {1} → {2} {3}")
    @MethodSource("matrix")
    void 메서드_보안_매트릭스(String path, Role role, int expectedStatus, String expectedCode) throws Exception {
        var request = get(path);
        if (role != null) {
            request = request.with(as(role));
        }

        var result = mockMvc.perform(request).andExpect(status().is(expectedStatus));

        if (expectedCode != null) {
            result.andExpect(jsonPath("$.error.code").value(expectedCode));
        }
    }

    // ── 거부 응답의 형태 ───────────────────────────────────────

    @Test
    @DisplayName("거부도 계약된 봉투로 나간다 — 필터 체인이라 어드바이스를 안 거친다")
    void 거부_응답_형태() throws Exception {
        mockMvc.perform(get("/probe/leader").with(as(Role.MEMBER)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.error.message").exists())
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    @DisplayName("★ 권한 부족의 두 경로가 같은 코드를 낸다")
    void 두_경로가_같은_코드를_낸다() throws Exception {
        // 같은 "권한 부족"이 두 곳에서 나간다 — @PreAuthorize가 던지면
        // GlobalExceptionHandler, 경로 규칙에서 걸리면 SecurityConfig의
        // AccessDeniedHandler다. 두 곳이 다른 코드를 내면 FE는 같은 상황에서
        // 다른 화면을 띄운다. 실제로 어긋난 적이 있어 여기서 고정한다.
        mockMvc.perform(get("/probe/leader").with(as(Role.MEMBER)))   // @PreAuthorize 경로
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));

        mockMvc.perform(get("/api/admin/members").with(as(Role.MEMBER)))   // 실제 보호 경로
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
    }

    // ── 보조 ──────────────────────────────────────────────────

    /** 해당 역할로 로그인한 상태를 만든다. 실제 필터가 만드는 것과 같은 주체를 넣는다. */
    private static RequestPostProcessor as(Role role) {
        AuthPrincipal principal = new AuthPrincipal(1L, role);
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities());
        return authentication(authentication);
    }
}
