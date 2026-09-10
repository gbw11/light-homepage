package kr.light.album;

import kr.light.auth.AuthPrincipal;
import kr.light.member.Role;
import kr.light.storage.R2Client;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.stream.Stream;

import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 앨범 정리 인가 (SPEC_API.md §10 · §6.11).
 *
 * <p><b>⚠️ 사진첩 안에서 권한이 갈리는 유일한 지점이다.</b> 열람은 {@code M},
 * 앨범 생성·삭제는 {@code L}인데 <b>정리만 {@code T}(전도사)</b>다.
 *
 * <p>임원이 못 하는 일을 막는 것이 아니다 — 임원은
 * {@code DELETE /api/albums/{id}}로 하나씩 지울 수 있다. 여기서 좁히는 것은
 * <b>사고 범위</b>다: 한 번의 호출로 여러 앨범이 되돌릴 수 없이 사라지는 창구다.
 * 그래서 "임원도 되겠지"로 넘겨짚기 쉬운 자리라 표로 못 박아 둔다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AlbumPurgeAuthorizationTest {

    private static final String CANDIDATES = "/api/admin/albums/purge-candidates";
    private static final String PURGE = "/api/admin/albums/purge";

    @Autowired MockMvc mockMvc;

    @MockitoBean R2Client r2Client;

    static Stream<Arguments> roles() {
        return Stream.of(
                arguments(null,        401, "UNAUTHORIZED"),
                arguments(Role.MEMBER, 403, "FORBIDDEN"),
                // ★ 임원도 막힌다 — 앨범 삭제(§6.3)가 L인 것과 갈리는 지점
                arguments(Role.LEADER, 403, "FORBIDDEN"),
                arguments(Role.PASTOR, 200, null)
        );
    }

    @ParameterizedTest(name = "GET purge-candidates × {0} → {1}")
    @MethodSource("roles")
    void 미리보기_인가(Role role, int expectedStatus, String expectedCode) throws Exception {
        var result = mockMvc.perform(withRole(get(CANDIDATES), role))
                .andExpect(status().is(expectedStatus));

        if (expectedCode != null) {
            result.andExpect(jsonPath("$.error.code").value(expectedCode))
                    .andExpect(jsonPath("$.data").doesNotExist());
        }
    }

    static Stream<Arguments> blockedRoles() {
        return Stream.of(
                arguments(null,        401, "UNAUTHORIZED"),
                arguments(Role.MEMBER, 403, "FORBIDDEN"),
                arguments(Role.LEADER, 403, "FORBIDDEN")
        );
    }

    @ParameterizedTest(name = "POST purge × {0} → {1}")
    @MethodSource("blockedRoles")
    void 실행_인가(Role role, int expectedStatus, String expectedCode) throws Exception {
        mockMvc.perform(withRole(post(PURGE), role)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"albumIds\": [1]}"))
                .andExpect(status().is(expectedStatus))
                .andExpect(jsonPath("$.error.code").value(expectedCode));
    }

    @Test
    @DisplayName("★ 막힌 요청은 R2를 건드리지 않는다 — 인가가 삭제보다 먼저다")
    void 막히면_R2를_건드리지_않는다() throws Exception {
        mockMvc.perform(withRole(post(PURGE), Role.LEADER)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"albumIds\": [1]}"))
                .andExpect(status().isForbidden());

        verify(r2Client, never()).deleteAll(org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("⚠️ 막힌 응답에 앨범 정보가 새지 않는다")
    void 막힌_응답에_정보가_없다() throws Exception {
        mockMvc.perform(withRole(get(CANDIDATES), Role.LEADER))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.data").doesNotExist());
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
