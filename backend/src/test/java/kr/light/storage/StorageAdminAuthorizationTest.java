package kr.light.storage;

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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.stream.Stream;

import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * {@code GET /api/admin/storage} 인가 (SPEC_API.md §10 · §8.5).
 *
 * <p>⚠️ <b>같은 {@code /api/admin} 아래인데 권한이 다르다.</b> 회원 관리
 * (§8.1~§8.4)는 {@code P}(전도사) 전용인데 용량 현황은 {@code L}(임원)부터다 —
 * 사진을 올리는 사람이 남은 용량을 봐야 하기 때문이다. 경로가 비슷하다고
 * 같은 권한일 것이라 넘겨짚기 쉬운 자리라 표로 못 박아 둔다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class StorageAdminAuthorizationTest {

    @Autowired MockMvc mockMvc;

    static Stream<Arguments> roles() {
        return Stream.of(
                arguments(null,        401, "UNAUTHORIZED"),
                arguments(Role.MEMBER, 403, "FORBIDDEN"),
                // ★ 임원부터 열린다 — 회원 관리(§8.1)와 갈리는 지점
                arguments(Role.LEADER, 200, null),
                arguments(Role.PASTOR, 200, null)
        );
    }

    @ParameterizedTest(name = "GET admin/storage × {0} → {1}")
    @MethodSource("roles")
    void 인가(Role role, int expectedStatus, String expectedCode) throws Exception {
        var result = mockMvc.perform(withRole(get("/api/admin/storage"), role))
                .andExpect(status().is(expectedStatus));

        if (expectedCode == null) {
            result.andExpect(jsonPath("$.data.limitBytes").isNumber());
        } else {
            result.andExpect(jsonPath("$.error.code").value(expectedCode))
                    .andExpect(jsonPath("$.data").doesNotExist());
        }
    }

    @Test
    @DisplayName("⚠️ 막힌 응답에 용량 숫자가 새지 않는다")
    void 막힌_응답에_숫자가_없다() throws Exception {
        mockMvc.perform(withRole(get("/api/admin/storage"), Role.MEMBER))
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
