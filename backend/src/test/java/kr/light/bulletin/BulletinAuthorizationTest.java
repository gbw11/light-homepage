package kr.light.bulletin;

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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.stream.Stream;

import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 주보 인가 (SPEC_API.md §10 · §5).
 *
 * <p><b>★ 열람은 권한 G다 — 로그인 없이 본다</b> (2026-10-14).
 *
 * <p><b>이 권한은 두 번 뒤집혔다</b> — G → M(2026-09-04) → G(2026-10-14).
 * 그만큼 조용히 바뀌기 쉬운 자리라, 이 표가 기준을 들고 있는다.
 * 뒤집을 때 고쳐야 할 곳은 둘이다: {@code BulletinController}의 메서드 단위
 * {@code @PreAuthorize}와 {@code SecurityConfig.PUBLIC_GET_PATHS}.
 * <b>한쪽만 고치면 익명이 401이나 403에서 막히고</b>, 이 표가 그걸 잡는다.
 *
 * <p>쓰기는 바뀐 적이 없다 — 그대로 임원(L)이다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BulletinAuthorizationTest {

    private static final long ANY_ID = 999999L;

    @Autowired MockMvc mockMvc;
    @Autowired MemberRepository memberRepository;

    @BeforeEach
    void setUp() {
        memberRepository.deleteAllInBatch();
    }

    /** 읽기 — 누구나 본다 (G) */
    static Stream<Arguments> readRoles() {
        return Stream.of(
                // ★ 비로그인도 200이다. 교회 밖에서 처음 온 사람이 이번 주
                //   예배 순서를 보는 것이 주보의 쓰임이라, 로그인을 요구하면
                //   그 쓰임이 사라진다.
                arguments(null,        200, null),
                arguments(Role.MEMBER, 200, null),
                arguments(Role.LEADER, 200, null),
                arguments(Role.PASTOR, 200, null)
        );
    }

    @ParameterizedTest(name = "GET latest × {0} → {1}")
    @MethodSource("readRoles")
    void 최신_조회_인가(Role role, int expectedStatus, String expectedCode) throws Exception {
        expect(get("/api/bulletins/latest"), role, expectedStatus, expectedCode);
    }

    @ParameterizedTest(name = "GET list × {0} → {1}")
    @MethodSource("readRoles")
    void 목록_인가(Role role, int expectedStatus, String expectedCode) throws Exception {
        expect(get("/api/bulletins"), role, expectedStatus, expectedCode);
    }

    @ParameterizedTest(name = "GET detail × {0} → {1}")
    @MethodSource("readRoles")
    void 상세_인가(Role role, int expectedStatus, String expectedCode) throws Exception {
        // 없는 주보라 통과하면 404다 — 인가가 그보다 먼저 판정된다
        var result = mockMvc.perform(withRole(get("/api/bulletins/" + ANY_ID), role));
        if (expectedCode == null) {
            result.andExpect(status().isNotFound());
        } else {
            result.andExpect(status().is(expectedStatus))
                    .andExpect(jsonPath("$.error.code").value(expectedCode));
        }
    }

    @ParameterizedTest(name = "GET page download × {0} → {1}")
    @MethodSource("readRoles")
    void 장별_다운로드_인가(Role role, int expectedStatus, String expectedCode) throws Exception {
        // ⚠️ 계약(§5)에 없는 경로다 — FE가 [CONTRACT]로 제안했다 (§5.6).
        //    열람과 같은 권한을 따라간다: 뷰어가 이미 같은 객체의 presigned
        //    URL을 내려주므로, 열람만 열고 다운로드를 막는 것은 의미가 없다.
        var result = mockMvc.perform(
                withRole(get("/api/bulletins/" + ANY_ID + "/pages/1/download"), role));

        if (expectedCode == null) {
            // 없는 주보라 통과하면 404다 — 인가가 그보다 먼저 판정된다
            result.andExpect(status().isNotFound());
        } else {
            result.andExpect(status().is(expectedStatus))
                    .andExpect(jsonPath("$.error.code").value(expectedCode));
        }
    }

    @Test
    @DisplayName("★ 주보가 없으면 data가 null이다 — 404가 아니다 (비로그인)")
    void 주보가_없으면_null() throws Exception {
        // "아직 안 올라옴"은 오류가 아니라 정상 상태다. 404를 주면 화면이
        // 에러 처리로 빠져 "주보를 준비 중입니다"를 못 보여준다.
        // ★ 비로그인으로 부른다 — 열린 경로가 끝까지 도는지까지 같이 본다.
        mockMvc.perform(get("/api/bulletins/latest"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").doesNotExist())
                .andExpect(jsonPath("$.error").doesNotExist());
    }

    @Test
    @DisplayName("⚠️ 막힌 쓰기 응답에 주보 내용이 새지 않는다")
    void 막힌_쓰기_응답이_비어_있다() throws Exception {
        // 읽기가 열리면서 이 확인의 대상이 쓰기로 옮겨갔다. 401 본문에
        // 엔티티가 실려 나가면, 막은 의미가 응답에서 사라진다.
        String body = mockMvc.perform(delete("/api/bulletins/" + ANY_ID))
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();

        org.assertj.core.api.Assertions.assertThat(body)
                .doesNotContain("serviceDate").doesNotContain("pages");
    }

    /** 쓰기 — 임원부터 */
    static Stream<Arguments> writeRoles() {
        return Stream.of(
                arguments(null,        401, "UNAUTHORIZED"),
                arguments(Role.MEMBER, 403, "FORBIDDEN"),
                arguments(Role.LEADER, 0,   null),
                arguments(Role.PASTOR, 0,   null)
        );
    }

    @ParameterizedTest(name = "POST bulletins × {0} → {1}")
    @MethodSource("writeRoles")
    void 업로드_인가(Role role, int expectedStatus, String expectedCode) throws Exception {
        var request = multipart("/api/bulletins")
                .file(new MockMultipartFile("pages", "1.webp", "image/webp", "x".getBytes()))
                .param("serviceDate", "2026-08-24");

        var result = mockMvc.perform(role == null ? request : request.with(as(role)));

        if (expectedCode == null) {
            // 통과 — 그 뒤 결과(201/409/…)는 인가의 관심사가 아니다
            result.andExpect(status().is(
                    org.hamcrest.Matchers.not(org.hamcrest.Matchers.isOneOf(401, 403))));
        } else {
            result.andExpect(status().is(expectedStatus))
                    .andExpect(jsonPath("$.error.code").value(expectedCode));
        }
    }

    @ParameterizedTest(name = "DELETE bulletin × {0} → {1}")
    @MethodSource("writeRoles")
    void 삭제_인가(Role role, int expectedStatus, String expectedCode) throws Exception {
        var request = delete("/api/bulletins/" + ANY_ID);
        var result = mockMvc.perform(role == null ? request : request.with(as(role)));

        if (expectedCode == null) {
            result.andExpect(status().is(
                    org.hamcrest.Matchers.not(org.hamcrest.Matchers.isOneOf(401, 403))));
        } else {
            result.andExpect(status().is(expectedStatus))
                    .andExpect(jsonPath("$.error.code").value(expectedCode));
        }
    }

    @Test
    @DisplayName("⚠️ 쓰기 경로에만 인가를 걸었다 — 새 쓰기 메서드를 추가하면 여기에 행을 넣을 것")
    void 쓰기_경로를_빠뜨리지_않았다() throws Exception {
        // ★ 읽기가 열려도 클래스 단위 @PreAuthorize("hasRole('MEMBER')")는 남겨뒀다.
        //   기본이 막힘이어야 새로 추가하는 메서드가 조용히 열리지 않는다.
        //   지금 걸려 있는 쓰기 두 개를 확인한다.
        mockMvc.perform(multipart("/api/bulletins")
                        .file(new MockMultipartFile("pages", "1.webp", "image/webp", "x".getBytes()))
                        .param("serviceDate", "2026-08-24"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/api/bulletins/" + ANY_ID))
                .andExpect(status().isUnauthorized());
    }

    private void expect(MockHttpServletRequestBuilder builder, Role role,
                        int expectedStatus, String expectedCode) throws Exception {
        var result = mockMvc.perform(withRole(builder, role))
                .andExpect(status().is(expectedStatus));
        if (expectedCode != null) {
            result.andExpect(jsonPath("$.error.code").value(expectedCode))
                    .andExpect(jsonPath("$.data").doesNotExist());
        }
    }

    private MockHttpServletRequestBuilder withRole(MockHttpServletRequestBuilder builder, Role role) {
        return role == null ? builder : builder.with(as(role));
    }

    private RequestPostProcessor as(Role role) {
        Member actor = memberRepository.saveAndFlush(Member.builder()
                .name("행위자")
                .loginId("actor_%s".formatted(role.name().toLowerCase()))
                .role(role)
                .build());

        AuthPrincipal principal = new AuthPrincipal(actor.getId(), role);
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities());
        return authentication(authentication);
    }
}
