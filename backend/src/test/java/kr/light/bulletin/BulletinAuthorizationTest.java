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
 * <p><b>★ 열람은 회원(M)부터다 — 2026-09-04에 G에서 올렸다.</b> 그전까지는
 * 비로그인도 볼 수 있었고, 문서 세 곳이 그렇게 적고 있었다. 되돌리는 변경이
 * 조용히 일어나지 않도록 이 표가 기준을 들고 있는다.
 *
 * <p>쓰기는 그대로 임원(L)이다.
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

    /** 읽기 — 로그인해야 본다 (M 이상) */
    static Stream<Arguments> readRoles() {
        return Stream.of(
                // ★ 비로그인은 401이다. 예산안(§10 주의 2)처럼 403이 아니다 —
                //   주보가 있다는 사실 자체는 비밀이 아니라 "로그인하면 볼 수
                //   있습니다"로 안내해야 하고, FE는 401에서 로그인 화면을 띄운다.
                arguments(null,        401, "UNAUTHORIZED"),
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

    @Test
    @DisplayName("★ 로그인했는데 주보가 없으면 data가 null이다 — 404가 아니다")
    void 주보가_없으면_null() throws Exception {
        // "아직 안 올라옴"은 오류가 아니라 정상 상태다. 404를 주면 화면이
        // 에러 처리로 빠져 "주보를 준비 중입니다"를 못 보여준다.
        mockMvc.perform(get("/api/bulletins/latest").with(as(Role.MEMBER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").doesNotExist())
                .andExpect(jsonPath("$.error").doesNotExist());
    }

    @Test
    @DisplayName("⚠️ 막힌 응답에 주보 내용이 새지 않는다")
    void 막힌_응답이_비어_있다() throws Exception {
        String body = mockMvc.perform(get("/api/bulletins/latest"))
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
        // 읽기가 공개라 클래스 단위 @PreAuthorize를 쓸 수 없다. 그래서 메서드마다
        // 달아야 하고, 그 방식은 빠뜨리기 쉽다. 지금 걸려 있는 두 개를 확인한다.
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
