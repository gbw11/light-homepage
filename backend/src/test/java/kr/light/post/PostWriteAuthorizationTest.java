package kr.light.post;

import kr.light.auth.AuthPrincipal;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.stream.Stream;

import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 인가 매트릭스 — 게시물 <b>쓰기</b> (ARCHITECTURE.md §5.3 · SPEC_API.md §10).
 *
 * <p>Jenkinsfile이 {@code --tests "*Authorization*"}으로 골라 돌린다 —
 * <b>이름에서 {@code Authorization}을 빼면 CI가 찾지 못한다.</b>
 *
 * <p>매트릭스의 {@code POST /api/posts} 행을 그대로 옮겼다:
 * <pre>
 * 401 · 403 · <b>403</b> · 200 · 200
 * </pre>
 * <b>MEMBER가 403이라는 칸이 핵심이다.</b> 읽기는 공개 공지를 볼 수 있으니
 * "회원이면 쓸 수도 있겠지"로 새기 쉬운데, 작성 권한은 네 분류 모두
 * LEADER 이상이다(§3.1 작성 열).
 *
 * <p>{@code PUT}·{@code DELETE}는 매트릭스에 행이 없지만 §3.5가 같은 권한
 * {@code L}이라고 정하므로 함께 본다 — 하나만 열려 있으면 지우는 것으로
 * 우회된다.
 *
 * <p>읽기 쪽 매트릭스는 {@link PostAuthorizationTest}가 덮는다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PostWriteAuthorizationTest {

    @Autowired MockMvc mockMvc;
    @Autowired MemberRepository memberRepository;
    @Autowired PostRepository postRepository;

    private static final String BODY = """
            {"category":"NOTICE_PUBLIC","title":"제목","body":{"type":"doc"},
             "pinned":false,"publish":true}
            """;

    /** 존재하지 않는 id. 인가를 통과해야 비로소 404까지 간다. */
    private static final long ANY_ID = 999_999L;

    @BeforeEach
    void setUp() {
        postRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();
    }

    static Stream<Arguments> roles() {
        return Stream.of(
                arguments((Role) null,  401, "UNAUTHORIZED"),
                arguments(Role.MEMBER,  403, "FORBIDDEN"),   // ★ 회원도 못 쓴다
                arguments(Role.LEADER,  null, null),         // 통과
                arguments(Role.PASTOR,  null, null)          // 계층상 통과
        );
    }

    @ParameterizedTest(name = "POST posts × {0} → {1}")
    @MethodSource("roles")
    void 작성_인가(Role role, Integer expectedStatus, String expectedCode) throws Exception {
        var request = post("/api/posts").contentType(MediaType.APPLICATION_JSON).content(BODY);

        if (expectedStatus == null) {
            mockMvc.perform(withRole(request, role)).andExpect(status().isCreated());
            return;
        }
        mockMvc.perform(withRole(request, role))
                .andExpect(status().is(expectedStatus))
                .andExpect(jsonPath("$.error.code").value(expectedCode));
    }

    @ParameterizedTest(name = "PUT posts × {0} → {1}")
    @MethodSource("roles")
    void 수정_인가(Role role, Integer expectedStatus, String expectedCode) throws Exception {
        var request = put("/api/posts/" + ANY_ID)
                .contentType(MediaType.APPLICATION_JSON).content(BODY);

        if (expectedStatus == null) {
            // 인가는 통과하고 대상이 없어 404
            mockMvc.perform(withRole(request, role)).andExpect(status().isNotFound());
            return;
        }
        mockMvc.perform(withRole(request, role))
                .andExpect(status().is(expectedStatus))
                .andExpect(jsonPath("$.error.code").value(expectedCode));
    }

    @ParameterizedTest(name = "DELETE posts × {0} → {1}")
    @MethodSource("roles")
    void 삭제_인가(Role role, Integer expectedStatus, String expectedCode) throws Exception {
        var request = delete("/api/posts/" + ANY_ID);

        if (expectedStatus == null) {
            mockMvc.perform(withRole(request, role)).andExpect(status().isNotFound());
            return;
        }
        mockMvc.perform(withRole(request, role))
                .andExpect(status().is(expectedStatus))
                .andExpect(jsonPath("$.error.code").value(expectedCode));
    }

    @Test
    @DisplayName("읽기는 열려 있어도 쓰기는 막힌다 — 같은 경로라 헷갈리기 쉽다")
    void 읽기와_쓰기가_갈린다() throws Exception {
        // GET /api/posts는 SecurityConfig에서 열려 있다(공개 공지 때문).
        // 경로 단위로 열었다면 POST까지 함께 열렸을 것이다 — 메서드를 나눠 건 이유다.
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/posts").param("category", "NOTICE_PUBLIC"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/posts").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnauthorized());
    }

    private MockHttpServletRequestBuilder withRole(MockHttpServletRequestBuilder builder, Role role) {
        return role == null ? builder : builder.with(as(role));
    }

    /**
     * ⚠️ 실제 회원 행을 만든다. 작성 시 작성자를 DB에서 조회하므로, 가짜 id를
     * 쓰면 401이 나서 정작 보려던 인가 결과가 가려진다.
     */
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
