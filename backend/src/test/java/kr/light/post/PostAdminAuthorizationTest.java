package kr.light.post;

import kr.light.auth.AuthPrincipal;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import kr.light.member.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.stream.Stream;

import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 인가 매트릭스 — 임원용 게시물 조회 (SPEC_API.md §3.6 · §3.7 · §10).
 *
 * <p>Jenkinsfile이 {@code --tests "*Authorization*"}으로 골라 돌린다.
 *
 * <pre>
 *                               G    M    L    T
 * GET /api/admin/posts/drafts  401  403  200  200
 * GET /api/admin/posts/{id}    401  403  404* 404*   (* 없는 id — 인가는 통과)
 * </pre>
 * <b>MEMBER가 403이라는 칸이 핵심이다.</b> 임시저장 글은 아직 공개되지 않은 글이라
 * 회의록·회원공지를 볼 수 있는 회원에게도 보이면 안 된다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PostAdminAuthorizationTest {

    @Autowired MockMvc mockMvc;
    @Autowired MemberRepository memberRepository;
    @Autowired PostRepository postRepository;

    private static final long ANY_ID = 999_999L;

    @BeforeEach
    void setUp() {
        postRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();
    }

    static Stream<Arguments> roles() {
        return Stream.of(
                arguments((Role) null, 401, "UNAUTHORIZED"),
                arguments(Role.MEMBER, 403, "FORBIDDEN"),    // ★ 회원은 쓰던 글을 볼 수 없다
                arguments(Role.LEADER, null, null),
                arguments(Role.PASTOR, null, null)           // 계층상 통과
        );
    }

    @ParameterizedTest(name = "GET admin/posts/drafts × {0} → {1}")
    @MethodSource("roles")
    void 임시저장_목록_인가(Role role, Integer expectedStatus, String expectedCode) throws Exception {
        var request = get("/api/admin/posts/drafts");

        if (expectedStatus == null) {
            mockMvc.perform(withRole(request, role)).andExpect(status().isOk());
            return;
        }
        mockMvc.perform(withRole(request, role))
                .andExpect(status().is(expectedStatus))
                .andExpect(jsonPath("$.error.code").value(expectedCode));
    }

    @ParameterizedTest(name = "GET admin/posts/:id × {0} → {1}")
    @MethodSource("roles")
    void 수정용_상세_인가(Role role, Integer expectedStatus, String expectedCode) throws Exception {
        var request = get("/api/admin/posts/" + ANY_ID);

        if (expectedStatus == null) {
            // 인가는 통과하고 대상이 없어 404
            mockMvc.perform(withRole(request, role)).andExpect(status().isNotFound());
            return;
        }
        mockMvc.perform(withRole(request, role))
                .andExpect(status().is(expectedStatus))
                .andExpect(jsonPath("$.error.code").value(expectedCode));
    }

    private MockHttpServletRequestBuilder withRole(MockHttpServletRequestBuilder builder, Role role) {
        return role == null ? builder : builder.with(as(role));
    }

    private RequestPostProcessor as(Role role) {
        Member actor = memberRepository.saveAndFlush(Member.builder()
                .name("작성자")
                .loginId("writer_%s".formatted(role.name().toLowerCase()))
                .role(role)
                .build());

        AuthPrincipal principal = new AuthPrincipal(actor.getId(), role);
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities());
        return authentication(authentication);
    }
}
