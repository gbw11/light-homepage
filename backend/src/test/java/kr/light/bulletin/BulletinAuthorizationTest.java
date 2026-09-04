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
 * <p>★ <b>읽기는 비로그인에게 열려 있다.</b> 주보는 교회 밖에서도 보는 공개
 * 자료다 — 게시물(§3)처럼 분류별로 갈리지 않는다. 그래서 클래스 단위로 인가를
 * 걸지 않고 <b>쓰기 두 개에만</b> 걸었는데, 그 방식은 새 메서드에서 빠뜨리기
 * 쉬운 모양이라 여기서 표로 못 박는다.
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

    /** 읽기 — 전부 열려 있다 */
    static Stream<Arguments> readRoles() {
        return Stream.of(
                arguments((Role) null), arguments(Role.MEMBER),
                arguments(Role.LEADER), arguments(Role.PASTOR));
    }

    @ParameterizedTest(name = "GET latest × {0} → 200")
    @MethodSource("readRoles")
    void 최신_조회는_누구나(Role role) throws Exception {
        mockMvc.perform(withRole(get("/api/bulletins/latest"), role))
                .andExpect(status().isOk());
    }

    @ParameterizedTest(name = "GET list × {0} → 200")
    @MethodSource("readRoles")
    void 목록은_누구나(Role role) throws Exception {
        mockMvc.perform(withRole(get("/api/bulletins"), role))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("★ 주보가 없으면 data가 null이다 — 404가 아니다")
    void 주보가_없으면_null() throws Exception {
        // "아직 안 올라옴"은 오류가 아니라 정상 상태다. 404를 주면 화면이
        // 에러 처리로 빠져 "주보를 준비 중입니다"를 못 보여준다.
        mockMvc.perform(get("/api/bulletins/latest"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").doesNotExist())
                .andExpect(jsonPath("$.error").doesNotExist());
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
