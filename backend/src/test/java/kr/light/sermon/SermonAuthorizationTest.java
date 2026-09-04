package kr.light.sermon;

import kr.light.auth.AuthPrincipal;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 인가 매트릭스 — 설교 (SPEC_API.md §10).
 *
 * <p><b>둘 다 권한 `G`입니다</b> — 교회 홈페이지의 설교 영상은 누구나 봅니다.
 * 그래서 이 테스트가 지키는 것은 "막혔는지"가 아니라 <b>"실수로 막히지
 * 않았는지"</b>다. 인증을 붙이다 보면 공개 경로를 함께 잠그기 쉽다.
 *
 * <p>⚠️ 클래스 이름에 {@code Authorization}이 들어가야 한다 — Jenkinsfile이
 * {@code --tests "*Authorization*"}으로 인가 테스트를 따로 먼저 돌린다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SermonAuthorizationTest {

    @Autowired MockMvc mockMvc;
    @Autowired SermonService sermonService;

    @MockitoBean YoutubeClient youtubeClient;

    @BeforeEach
    void setUp() {
        sermonService.clearCacheForTest();
        when(youtubeClient.fetchPlaylist(anyString(), anyInt())).thenReturn(List.of());
        when(youtubeClient.findLive(any())).thenReturn(Optional.empty());
    }

    /** {@code null} 역할은 비로그인이다. 전부 200이어야 한다 */
    static Stream<Arguments> roles() {
        return Stream.of(
                arguments((Role) null),
                arguments(Role.MEMBER),
                arguments(Role.LEADER),
                arguments(Role.PASTOR));
    }

    @ParameterizedTest(name = "GET sermons × {0} → 200")
    @MethodSource("roles")
    void 목록_인가(Role role) throws Exception {
        mockMvc.perform(withRole(get("/api/sermons"), role))
                .andExpect(status().isOk());
    }

    @ParameterizedTest(name = "GET sermons/live × {0} → 200")
    @MethodSource("roles")
    void 라이브_인가(Role role) throws Exception {
        mockMvc.perform(withRole(get("/api/sermons/live"), role))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("읽기는 열려 있어도 쓰기 경로는 없다 — 설교는 우리가 저장하지 않는다")
    void 쓰기_경로가_없다() throws Exception {
        // 영상은 YouTube에 있고 우리는 중계만 한다. POST가 열려 있으면
        // 없어야 할 기능이 생긴 것이다 (405 또는 401/403이어야 한다)
        mockMvc.perform(post("/api/sermons"))
                .andExpect(result -> {
                    int s = result.getResponse().getStatus();
                    org.assertj.core.api.Assertions.assertThat(s)
                            .as("POST /api/sermons 는 열려 있으면 안 된다")
                            .isNotEqualTo(200)
                            .isNotEqualTo(201);
                });
    }

    private MockHttpServletRequestBuilder withRole(MockHttpServletRequestBuilder builder, Role role) {
        if (role == null) {
            return builder;
        }
        AuthPrincipal principal = new AuthPrincipal(1L, role);
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities());
        return builder.with(authentication(authentication));
    }
}
