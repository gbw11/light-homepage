package kr.light.admin;

import kr.light.auth.AuthPrincipal;
import kr.light.auth.RefreshTokenRepository;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import kr.light.member.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.stream.Stream;

import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 인가 매트릭스 — 회원 관리 (SPEC_API.md §10 · ARCHITECTURE.md §5.3).
 *
 * <p>Jenkinsfile이 {@code --tests "*Authorization*"}으로 골라 돌린다 —
 * <b>이름에서 {@code Authorization}을 빼면 CI가 찾지 못한다.</b>
 *
 * <p>매트릭스 3행을 그대로 옮겼다. 굵게 표시된 칸이 사고가 나는 지점이다:
 * <pre>
 * GET   /admin/members           401 · 403 · 403 · <b>403</b> · 200
 * POST  /admin/members/{id}/approve  401 · 403 · 403 · <b>403</b> · 200
 * PATCH /admin/members/{id}/role     401 · 403 · 403 · <b>403</b> · 200
 * </pre>
 *
 * <p><b>LEADER가 403이라는 칸이 핵심이다.</b> 역할 계층상 LEADER는 MEMBER를
 * 포함하므로 "임원이니 관리도 되겠지"로 새기 쉽다. 회원 명단 전체와 역할 부여가
 * 걸려 있어 여기가 뚫리면 피해가 크다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MemberAdminAuthorizationTest {

    @Autowired MockMvc mockMvc;
    @Autowired MemberRepository memberRepository;
    @Autowired RefreshTokenRepository refreshTokenRepository;

    /** 존재하지 않는 대상 id. 인가를 통과해야 비로소 404까지 간다. */
    private static final long ANY_ID = 999_999L;

    @BeforeEach
    void setUp() {
        refreshTokenRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();
    }

    static Stream<Arguments> roles() {
        return Stream.of(
                arguments((Role) null,  401, "UNAUTHORIZED"),
                arguments(Role.PENDING, 403, "PENDING_APPROVAL"),
                arguments(Role.MEMBER,  403, "FORBIDDEN"),
                arguments(Role.LEADER,  403, "FORBIDDEN"),   // ★ 임원도 막힌다
                arguments(Role.PASTOR,  404, "NOT_FOUND")    // 통과 → 없는 회원이라 404
        );
    }

    @ParameterizedTest(name = "GET members × {0} → {1}")
    @MethodSource("roles")
    void 목록_인가(Role role, int expectedStatus, String expectedCode) throws Exception {
        // 목록은 대상 회원이 없어도 200이므로 PASTOR만 기대값이 다르다
        int status = (role == Role.PASTOR) ? 200 : expectedStatus;
        var result = mockMvc.perform(withRole(get("/api/admin/members"), role))
                .andExpect(status().is(status));

        if (role != Role.PASTOR) {
            result.andExpect(jsonPath("$.error.code").value(expectedCode));
        }
    }

    @ParameterizedTest(name = "POST approve × {0} → {1}")
    @MethodSource("roles")
    void 승인_인가(Role role, int expectedStatus, String expectedCode) throws Exception {
        mockMvc.perform(withRole(post("/api/admin/members/" + ANY_ID + "/approve"), role))
                .andExpect(status().is(expectedStatus))
                .andExpect(jsonPath("$.error.code").value(expectedCode));
    }

    @ParameterizedTest(name = "PATCH role × {0} → {1}")
    @MethodSource("roles")
    void 역할변경_인가(Role role, int expectedStatus, String expectedCode) throws Exception {
        var request = patch("/api/admin/members/" + ANY_ID + "/role")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"role\":\"LEADER\"}");

        mockMvc.perform(withRole(request, role))
                .andExpect(status().is(expectedStatus))
                .andExpect(jsonPath("$.error.code").value(expectedCode));
    }

    @ParameterizedTest(name = "POST reject × {0} → {1}")
    @MethodSource("roles")
    void 거절_인가(Role role, int expectedStatus, String expectedCode) throws Exception {
        var request = post("/api/admin/members/" + ANY_ID + "/reject")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"확인 불가\"}");

        mockMvc.perform(withRole(request, role))
                .andExpect(status().is(expectedStatus))
                .andExpect(jsonPath("$.error.code").value(expectedCode));
    }

    @Test
    @DisplayName("클래스 단위 @PreAuthorize라 새 메서드를 추가해도 기본이 막힘이다")
    void 클래스_단위로_걸려_있다() throws Exception {
        // 존재하지 않는 하위 경로도 인증 없이는 통과하지 못한다.
        // (메서드마다 달았다면 새 메서드에서 빠뜨릴 수 있다)
        mockMvc.perform(get("/api/admin/members/anything"))
                .andExpect(status().isUnauthorized());
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder withRole(
            org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder builder, Role role) {
        return role == null ? builder : builder.with(as(role));
    }

    /**
     * 해당 역할로 로그인한 상태를 만든다.
     *
     * <p>⚠️ <b>실제 회원 행을 만든다.</b> 가짜 id를 쓰면 감사로그의 행위자를
     * 조회하는 단계에서 401이 나서, 정작 보려던 인가 결과가 가려진다.
     */
    private RequestPostProcessor as(Role role) {
        Member actor = memberRepository.saveAndFlush(Member.builder()
                .name("행위자")
                .email("actor-%s@light.kr".formatted(role.name().toLowerCase()))
                .role(role)
                .build());

        AuthPrincipal principal = new AuthPrincipal(actor.getId(), role);
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities());
        return authentication(authentication);
    }
}
