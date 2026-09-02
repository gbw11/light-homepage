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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.Instant;
import java.util.EnumMap;
import java.util.Map;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 게시물 열람 인가 — <b>HTTP로 관통한다</b> (SPEC_API.md §10).
 *
 * <h2>왜 {@link PostAuthorizationTest}가 있는데 또 만드는가</h2>
 * 그쪽은 {@link PostQueryService}의 관문을 <b>직접</b> 부른다. 규칙 자체는
 * 정확히 검증하지만, <b>컨트롤러가 그 관문을 실제로 부르는지는 보지 않는다.</b>
 * 누군가 {@code PostController}에서 관문 호출을 빼도 그 테스트는 전부 통과한다 —
 * 그리고 회의록이 인터넷에 열린다.
 *
 * <p>매트릭스가 정하는 것은 "서비스가 어떤 예외를 던지는가"가 아니라
 * <b>"클라이언트가 어떤 상태 코드를 받는가"</b>다. 그래서 필터 체인부터
 * 응답 본문까지 태워서 본다.
 *
 * <p>이 검증은 인증 수단이 없던 시절에는 GUEST 행밖에 볼 수 없었다.
 * v1.3 인증이 들어오면서 네 역할을 전부 태울 수 있게 됐다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PostReadAuthorizationTest {

    @Autowired MockMvc mockMvc;
    @Autowired PostRepository postRepository;
    @Autowired MemberRepository memberRepository;

    /** 분류마다 글 하나씩 — 상세 조회의 대상 */
    private final Map<PostCategory, Long> postIds = new EnumMap<>(PostCategory.class);

    @BeforeEach
    void setUp() {
        postRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();
        postIds.clear();

        for (PostCategory category : PostCategory.values()) {
            Post post = postRepository.saveAndFlush(Post.builder()
                    .category(category)
                    .title(secretTitle(category))
                    // slug는 모든 분류가 갖는다 (§3.2 · V5에서 NOT NULL)
                    .slug("slug-" + category.name().toLowerCase())
                    .body("{\"blocks\":[]}")
                    .pinned(false)
                    .publishedAt(Instant.now().minusSeconds(3600))
                    .build());
            postIds.put(category, post.getId());
        }
    }

    /**
     * 목록 조회 (SPEC_API.md §10).
     *
     * <p>{@code null} 역할은 비로그인이다.
     */
    static Stream<Arguments> listMatrix() {
        return Stream.of(
                // category,                          role,        기대 상태, 기대 코드
                arguments(PostCategory.NOTICE_PUBLIC, null,        200, null),
                arguments(PostCategory.NOTICE_PUBLIC, Role.MEMBER, 200, null),
                arguments(PostCategory.NOTICE_PUBLIC, Role.LEADER, 200, null),
                arguments(PostCategory.NOTICE_PUBLIC, Role.PASTOR, 200, null),

                arguments(PostCategory.NOTICE_MEMBER, null,        401, "UNAUTHORIZED"),
                arguments(PostCategory.NOTICE_MEMBER, Role.MEMBER, 200, null),
                arguments(PostCategory.NOTICE_MEMBER, Role.LEADER, 200, null),
                arguments(PostCategory.NOTICE_MEMBER, Role.PASTOR, 200, null),

                // ★ 회의록은 v1.3에서 L → M으로 완화됐다 (§9-D)
                arguments(PostCategory.MINUTES,       null,        401, "UNAUTHORIZED"),
                arguments(PostCategory.MINUTES,       Role.MEMBER, 200, null),
                arguments(PostCategory.MINUTES,       Role.LEADER, 200, null),
                arguments(PostCategory.MINUTES,       Role.PASTOR, 200, null),

                // ★ 예산안 목록은 비로그인도 401이 아니라 403이다 (§10 주의 2)
                arguments(PostCategory.BUDGET,        null,        403, "FORBIDDEN"),
                arguments(PostCategory.BUDGET,        Role.MEMBER, 403, "FORBIDDEN"),
                arguments(PostCategory.BUDGET,        Role.LEADER, 200, null),
                arguments(PostCategory.BUDGET,        Role.PASTOR, 200, null)
        );
    }

    @ParameterizedTest(name = "GET posts?category={0} × {1} → {2}")
    @MethodSource("listMatrix")
    void 목록_인가(PostCategory category, Role role, int expectedStatus, String expectedCode)
            throws Exception {

        var result = mockMvc.perform(withRole(
                        get("/api/posts").param("category", category.name()), role))
                .andExpect(status().is(expectedStatus));

        if (expectedCode == null) {
            result.andExpect(jsonPath("$.data").exists());
        } else {
            result.andExpect(jsonPath("$.error.code").value(expectedCode))
                    .andExpect(jsonPath("$.data").doesNotExist());
        }
    }

    /**
     * 상세 조회 (SPEC_API.md §10).
     *
     * <p>목록과 갈리는 지점이 둘이다 — <b>예산안은 403이 아니라 404</b>(존재를
     * 숨긴다), 그리고 비로그인도 401이 아니라 404다.
     */
    static Stream<Arguments> detailMatrix() {
        return Stream.of(
                arguments(PostCategory.NOTICE_PUBLIC, null,        200, null),
                arguments(PostCategory.NOTICE_PUBLIC, Role.MEMBER, 200, null),

                arguments(PostCategory.NOTICE_MEMBER, null,        401, "UNAUTHORIZED"),
                arguments(PostCategory.NOTICE_MEMBER, Role.MEMBER, 200, null),

                arguments(PostCategory.MINUTES,       null,        401, "UNAUTHORIZED"),
                arguments(PostCategory.MINUTES,       Role.MEMBER, 200, null),
                arguments(PostCategory.MINUTES,       Role.LEADER, 200, null),

                // ★ 존재 자체를 숨긴다 — 403을 주면 "그 글이 있다"가 새어나간다
                arguments(PostCategory.BUDGET,        null,        404, "NOT_FOUND"),
                arguments(PostCategory.BUDGET,        Role.MEMBER, 404, "NOT_FOUND"),
                arguments(PostCategory.BUDGET,        Role.LEADER, 200, null),
                arguments(PostCategory.BUDGET,        Role.PASTOR, 200, null)
        );
    }

    @ParameterizedTest(name = "GET posts/{0}id × {1} → {2}")
    @MethodSource("detailMatrix")
    void 상세_인가(PostCategory category, Role role, int expectedStatus, String expectedCode)
            throws Exception {

        var result = mockMvc.perform(withRole(
                        get("/api/posts/" + postIds.get(category)), role))
                .andExpect(status().is(expectedStatus));

        if (expectedCode != null) {
            result.andExpect(jsonPath("$.error.code").value(expectedCode));
        }
    }

    @Test
    @DisplayName("★ 막힌 응답에 제목이 새지 않는다 — 상태 코드만 막고 본문이 새면 소용없다")
    void 막힌_응답에_내용이_없다() throws Exception {
        for (PostCategory category : new PostCategory[]{
                PostCategory.NOTICE_MEMBER, PostCategory.MINUTES, PostCategory.BUDGET}) {

            String listBody = mockMvc.perform(
                            get("/api/posts").param("category", category.name()))
                    .andReturn().getResponse().getContentAsString();
            String detailBody = mockMvc.perform(get("/api/posts/" + postIds.get(category)))
                    .andReturn().getResponse().getContentAsString();

            assertThat(listBody).as("%s 목록", category).doesNotContain(secretTitle(category));
            assertThat(detailBody).as("%s 상세", category).doesNotContain(secretTitle(category));
        }
    }

    @Test
    @DisplayName("★ 분류를 추가하면 두 매트릭스에 행을 넣어야 한다")
    void 분류가_늘면_매트릭스도_늘어야_한다() {
        // 행을 안 넣으면 그 분류는 아무도 확인하지 않은 채 열린다.
        assertThat(listMatrix().map(a -> a.get()[0]).distinct())
                .as("목록 매트릭스가 모든 분류를 덮는다")
                .hasSize(PostCategory.values().length);
        assertThat(detailMatrix().map(a -> a.get()[0]).distinct())
                .as("상세 매트릭스가 모든 분류를 덮는다")
                .hasSize(PostCategory.values().length);
    }

    // ── 보조 ──────────────────────────────────────────────────

    /** 응답에 새면 바로 알아볼 수 있는 제목 */
    private static String secretTitle(PostCategory category) {
        return "새면안되는-" + category.name();
    }

    private MockHttpServletRequestBuilder withRole(MockHttpServletRequestBuilder builder, Role role) {
        if (role == null) {
            return builder;     // 비로그인
        }
        AuthPrincipal principal = new AuthPrincipal(1L, role);
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities());
        return builder.with(authentication(authentication));
    }
}
