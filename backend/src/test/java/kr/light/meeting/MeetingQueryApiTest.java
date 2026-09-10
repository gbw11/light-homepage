package kr.light.meeting;

import kr.light.auth.AuthPrincipal;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import kr.light.member.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
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
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.stream.Stream;

import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 월례회 목록·상세와 <b>열람 기간 판정</b> (SPEC_API.md §7.1 · §7.2).
 *
 * <p>이 기능의 무게는 목록이 아니라 <b>"지금 이 사람이 이 자료를 열 수
 * 있는가"</b>다. 그 판단이 어긋나면 기간이 끝난 자료가 열린다.
 *
 * <p>⚠️ 열람은 회원(M)부터다 — §7 본문에 남아 있는 익명 서술은 공개 열람
 * 시절의 것이고, §10 매트릭스·FE·DB가 모두 {@code M}이다
 * ({@link MeetingController} 주석 참고).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MeetingQueryApiTest {

    @Autowired MockMvc mockMvc;
    @Autowired MeetingDocRepository meetingDocRepository;
    @Autowired MemberRepository memberRepository;

    @BeforeEach
    void setUp() {
        meetingDocRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();
    }

    // ── §7.1 목록 ────────────────────────────────────────────

    @Nested
    @DisplayName("목록")
    class Listing {

        @Test
        @DisplayName("★ 종료된 자료도 목록에 남는다 — 존재는 알리되 내용만 막는다")
        void 종료된_것도_남는다() throws Exception {
            saveDoc("끝난 월례회", closedWindow());
            saveDoc("진행 중", openWindow());

            mockMvc.perform(get("/api/meetings").with(as(Role.MEMBER)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.items.length()").value(2));
        }

        @Test
        @DisplayName("status는 저장값이 아니라 현재 시각으로 계산한다")
        void 상태_계산() throws Exception {
            saveDoc("시작 전", scheduledWindow());
            saveDoc("진행 중", openWindow());
            saveDoc("끝남", closedWindow());

            String body = mockMvc.perform(get("/api/meetings").with(as(Role.MEMBER)))
                    .andExpect(status().isOk())
                    .andReturn().getResponse().getContentAsString();

            org.assertj.core.api.Assertions.assertThat(body)
                    .contains("SCHEDULED").contains("OPEN").contains("CLOSED");
        }

        @Test
        @DisplayName("최근 월례회가 위다")
        void 정렬() throws Exception {
            saveDoc("오래된 것", openWindow(), LocalDate.of(2026, 1, 10));
            saveDoc("최근 것", openWindow(), LocalDate.of(2026, 8, 24));

            mockMvc.perform(get("/api/meetings").with(as(Role.MEMBER)))
                    .andExpect(jsonPath("$.data.items[0].title").value("최근 것"));
        }

        @Test
        @DisplayName("자료가 없으면 빈 목록이다")
        void 빈_목록() throws Exception {
            mockMvc.perform(get("/api/meetings").with(as(Role.MEMBER)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.items").isEmpty());
        }
    }

    // ── §7.2 상세 · 열람 판정 ────────────────────────────────

    @Nested
    @DisplayName("상세 — canView")
    class Detail {

        @Test
        @DisplayName("기간 안이면 회원도 볼 수 있다")
        void 기간_안() throws Exception {
            Long id = saveDoc("진행 중", openWindow());

            mockMvc.perform(get("/api/meetings/" + id).with(as(Role.MEMBER)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.status").value("OPEN"))
                    .andExpect(jsonPath("$.data.canView").value(true))
                    .andExpect(jsonPath("$.data.viewReason")
                            .value(org.hamcrest.Matchers.nullValue()))
                    .andExpect(jsonPath("$.data.remainingSeconds")
                            .value(org.hamcrest.Matchers.greaterThan(0)));
        }

        @Test
        @DisplayName("★ 기간이 끝나면 회원은 못 본다 — viewReason이 이유를 담는다")
        void 기간_종료() throws Exception {
            Long id = saveDoc("끝남", closedWindow());

            mockMvc.perform(get("/api/meetings/" + id).with(as(Role.MEMBER)))
                    .andExpect(jsonPath("$.data.status").value("CLOSED"))
                    .andExpect(jsonPath("$.data.canView").value(false))
                    .andExpect(jsonPath("$.data.viewReason").value("PERIOD_CLOSED"))
                    .andExpect(jsonPath("$.data.remainingSeconds").value(0));
        }

        @Test
        @DisplayName("아직 시작 전이면 PERIOD_NOT_STARTED")
        void 시작_전() throws Exception {
            Long id = saveDoc("시작 전", scheduledWindow());

            mockMvc.perform(get("/api/meetings/" + id).with(as(Role.MEMBER)))
                    .andExpect(jsonPath("$.data.status").value("SCHEDULED"))
                    .andExpect(jsonPath("$.data.canView").value(false))
                    .andExpect(jsonPath("$.data.viewReason").value("PERIOD_NOT_STARTED"));
        }

        /**
         * ★ 같은 자료라도 사람에 따라 {@code canView}가 다르다.
         *
         * <p>임원 이상은 기간을 건너뛴다 — 자료를 올리고 관리하는 쪽이라
         * 기간이 끝난 뒤에도 확인해야 한다 (§7.1).
         */
        static Stream<Arguments> closedDocRoles() {
            return Stream.of(
                    arguments(Role.MEMBER, false),
                    arguments(Role.LEADER, true),
                    arguments(Role.PASTOR, true));
        }

        @ParameterizedTest(name = "종료된 자료 × {0} → canView={1}")
        @MethodSource("closedDocRoles")
        void 임원은_기간을_건너뛴다(Role role, boolean expected) throws Exception {
            Long id = saveDoc("끝남", closedWindow());

            mockMvc.perform(get("/api/meetings/" + id).with(as(role)))
                    .andExpect(jsonPath("$.data.canView").value(expected));
        }

        @Test
        @DisplayName("없는 자료는 404")
        void 없는_자료() throws Exception {
            mockMvc.perform(get("/api/meetings/999999").with(as(Role.MEMBER)))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("⚠️ 응답에 R2 키가 없다 — §7은 presigned URL도 주지 않는다")
        void 키가_새지_않는다() throws Exception {
            Long id = saveDoc("진행 중", openWindow());

            String body = mockMvc.perform(get("/api/meetings/" + id).with(as(Role.MEMBER)))
                    .andReturn().getResponse().getContentAsString();

            org.assertj.core.api.Assertions.assertThat(body)
                    .doesNotContain("r2Key").doesNotContain("X-Amz").doesNotContain("meetings/");
        }
    }

    // ── 인가 (§10) ───────────────────────────────────────────

    static Stream<Arguments> roles() {
        return Stream.of(
                // ★ 비로그인은 401 — 익명 열람은 2026-09-04에 접었다
                arguments(null,        401, "UNAUTHORIZED"),
                arguments(Role.MEMBER, 200, null),
                arguments(Role.LEADER, 200, null),
                arguments(Role.PASTOR, 200, null));
    }

    @ParameterizedTest(name = "GET meetings × {0} → {1}")
    @MethodSource("roles")
    void 목록_인가(Role role, int expectedStatus, String expectedCode) throws Exception {
        var result = mockMvc.perform(withRole(get("/api/meetings"), role))
                .andExpect(status().is(expectedStatus));

        if (expectedCode != null) {
            result.andExpect(jsonPath("$.error.code").value(expectedCode));
        }
    }

    @Test
    @DisplayName("★ 클래스 단위 @PreAuthorize라 새 메서드를 추가해도 기본이 막힘이다")
    void 클래스_단위로_걸려_있다() throws Exception {
        mockMvc.perform(get("/api/meetings/anything"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("⚠️ 막힌 응답에 자료 제목이 새지 않는다")
    void 막힌_응답이_비어_있다() throws Exception {
        saveDoc("새면안되는제목", openWindow());

        String body = mockMvc.perform(get("/api/meetings"))
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();

        org.assertj.core.api.Assertions.assertThat(body).doesNotContain("새면안되는제목");
    }

    // ── 보조 ─────────────────────────────────────────────────

    private record Window(Instant from, Instant until) {
    }

    private static Window openWindow() {
        return new Window(Instant.now().minus(1, ChronoUnit.HOURS),
                Instant.now().plus(2, ChronoUnit.DAYS));
    }

    private static Window closedWindow() {
        return new Window(Instant.now().minus(5, ChronoUnit.DAYS),
                Instant.now().minus(1, ChronoUnit.DAYS));
    }

    private static Window scheduledWindow() {
        return new Window(Instant.now().plus(1, ChronoUnit.DAYS),
                Instant.now().plus(3, ChronoUnit.DAYS));
    }

    private Long saveDoc(String title, Window window) {
        return saveDoc(title, window, LocalDate.of(2026, 8, 24));
    }

    private Long saveDoc(String title, Window window, LocalDate meetingDate) {
        return meetingDocRepository.saveAndFlush(MeetingDoc.builder()
                .title(title)
                .meetingDate(meetingDate)
                .viewableFrom(window.from())
                .viewableUntil(window.until())
                .pageCount(10)
                .build()).getId();
    }

    private MockHttpServletRequestBuilder withRole(MockHttpServletRequestBuilder builder, Role role) {
        return role == null ? builder : builder.with(as(role));
    }

    private org.springframework.test.web.servlet.request.RequestPostProcessor as(Role role) {
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
