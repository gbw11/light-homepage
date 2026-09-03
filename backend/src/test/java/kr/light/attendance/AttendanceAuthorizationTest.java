package kr.light.attendance;

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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.stream.Stream;

import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 출석부 인가 — <b>전 경로 L(임원) 이상</b> (SPEC_API.md §10 · §13.0).
 *
 * <p>출석 기록은 "누가 교회에 안 나왔는지"의 기록이라 <b>예산안과 같은 급의
 * 민감 정보</b>다. 회원(M)에게 열리면 교인들이 서로의 결석을 들여다보게 된다 —
 * 그 사고는 되돌릴 수 없다.
 *
 * <p>읽기와 쓰기를 나누지 않았다. 예산안처럼 <b>존재를 숨길</b> 필요는 없어서
 * (출석부가 있다는 사실 자체는 비밀이 아니다) 막힌 응답은 404가 아니라
 * 401/403이다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AttendanceAuthorizationTest {

    /** 인가는 대상 존재 여부보다 먼저 판정된다 — 회차를 만들지 않아도 된다 */
    private static final long ANY_ID = 999999L;

    @Autowired MockMvc mockMvc;
    @Autowired MemberRepository memberRepository;
    @Autowired AttendanceEntryRepository entryRepository;
    @Autowired AttendanceSessionRepository sessionRepository;

    @BeforeEach
    void setUp() {
        entryRepository.deleteAllInBatch();
        sessionRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();
    }

    /**
     * §10 출석부 행. {@code null} 역할은 비로그인이다.
     *
     * <p>기대 코드가 {@code null}이면 "통과해야 한다"는 뜻이다 — 그 뒤의 상태
     * 코드는 대상이 없어서 404일 수도 있어 확정하지 않고, <b>401도 403도 아님</b>만
     * 본다.
     */
    static Stream<Arguments> roles() {
        return Stream.of(
                arguments(null,        401, "UNAUTHORIZED"),
                // ★ 회원에게 막혀 있다 — 이 한 줄이 이 기능의 전부다
                arguments(Role.MEMBER, 403, "FORBIDDEN"),
                arguments(Role.LEADER, 0,   null),
                // PASTOR는 RoleHierarchy로 LEADER를 포함한다 (별도 표기 없이 통과)
                arguments(Role.PASTOR, 0,   null)
        );
    }

    @ParameterizedTest(name = "GET sessions × {0} → {1}")
    @MethodSource("roles")
    void 목록_인가(Role role, int expectedStatus, String expectedCode) throws Exception {
        gate(get("/api/attendance/sessions"), role, expectedStatus, expectedCode);
    }

    @ParameterizedTest(name = "POST sessions × {0} → {1}")
    @MethodSource("roles")
    void 생성_인가(Role role, int expectedStatus, String expectedCode) throws Exception {
        gate(post("/api/attendance/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"date\":\"2026-08-30\",\"type\":\"SUNDAY_SERVICE\",\"title\":\"주일예배\"}"),
                role, expectedStatus, expectedCode);
    }

    @ParameterizedTest(name = "GET session detail × {0} → {1}")
    @MethodSource("roles")
    void 상세_인가(Role role, int expectedStatus, String expectedCode) throws Exception {
        gate(get("/api/attendance/sessions/" + ANY_ID), role, expectedStatus, expectedCode);
    }

    @ParameterizedTest(name = "PUT entries × {0} → {1}")
    @MethodSource("roles")
    void 기록_인가(Role role, int expectedStatus, String expectedCode) throws Exception {
        gate(put("/api/attendance/sessions/" + ANY_ID + "/entries")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[]"),
                role, expectedStatus, expectedCode);
    }

    @ParameterizedTest(name = "DELETE session × {0} → {1}")
    @MethodSource("roles")
    void 삭제_인가(Role role, int expectedStatus, String expectedCode) throws Exception {
        gate(delete("/api/attendance/sessions/" + ANY_ID), role, expectedStatus, expectedCode);
    }

    @Test
    @DisplayName("★ 클래스 단위 @PreAuthorize라 새 메서드를 추가해도 기본이 막힘이다")
    void 클래스_단위로_걸려_있다() throws Exception {
        // 메서드마다 달았다면 새 메서드에서 빠뜨릴 수 있고, 여기서 빠뜨리면
        // 출석부가 회원 전체에게 열린다.
        mockMvc.perform(get("/api/attendance/anything"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("⚠️ 막힌 응답에 이름이 새지 않는다 — 상태 코드만 막고 본문이 새면 소용없다")
    void 막힌_응답에_명단이_없다() throws Exception {
        String body = mockMvc.perform(get("/api/attendance/sessions/" + ANY_ID)
                        .with(as(Role.MEMBER)))
                .andExpect(status().isForbidden())
                .andReturn().getResponse().getContentAsString();

        org.assertj.core.api.Assertions.assertThat(body)
                .doesNotContain("entries").doesNotContain("rosterId");
    }

    // ── 보조 ──────────────────────────────────────────────────

    private void gate(MockHttpServletRequestBuilder builder, Role role,
                      int expectedStatus, String expectedCode) throws Exception {

        ResultActions result = mockMvc.perform(role == null ? builder : builder.with(as(role)));

        if (expectedCode == null) {
            // 통과해야 하는 역할 — 대상이 없어 404일 수 있으므로 상태는 확정하지 않는다
            result.andExpect(status().is(not401or403()));
        } else {
            result.andExpect(status().is(expectedStatus))
                    .andExpect(jsonPath("$.error.code").value(expectedCode));
        }
    }

    private static org.hamcrest.Matcher<Integer> not401or403() {
        return org.hamcrest.Matchers.not(org.hamcrest.Matchers.isOneOf(401, 403));
    }

    /**
     * 해당 역할로 로그인한 상태를 만든다.
     *
     * <p>⚠️ <b>실제 회원 행을 만든다.</b> 가짜 id를 쓰면 컨트롤러가 기록자를
     * 조회하는 단계에서 401이 나서, 정작 보려던 인가 결과가 가려진다.
     */
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
