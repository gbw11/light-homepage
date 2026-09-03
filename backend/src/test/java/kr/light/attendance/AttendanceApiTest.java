package kr.light.attendance;

import com.fasterxml.jackson.databind.ObjectMapper;
import kr.light.auth.AuthPrincipal;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import kr.light.member.Role;
import kr.light.roster.RosterEntry;
import kr.light.roster.RosterEntryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
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

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 출석부 (SPEC_API.md §13).
 *
 * <p>이 기능의 어려운 점은 기능이 아니라 <b>두 가지 구별</b>이다:
 * <ul>
 *   <li>{@code null}(기록 없음)과 {@code ABSENT}(결석) — 아무도 체크하지 않은
 *       사람과 결석으로 기록된 사람은 다르다 (§13.0)</li>
 *   <li>upsert와 전체 교체 — 두 임원이 서로 다른 마을을 동시에 체크하는 것이
 *       정상 흐름이라, 전체 교체면 서로의 기록을 덮어쓴다 (§13.4)</li>
 * </ul>
 * 테스트의 무게가 그 둘에 실려 있다.
 *
 * <p>⚠️ 이름에 {@code Authorization}을 넣지 않았다. 인가 매트릭스는
 * {@link AttendanceAuthorizationTest}다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AttendanceApiTest {

    @Autowired MockMvc mockMvc;
    @Autowired AttendanceSessionRepository sessionRepository;
    @Autowired AttendanceEntryRepository entryRepository;
    @Autowired RosterEntryRepository rosterRepository;
    @Autowired MemberRepository memberRepository;
    @Autowired ObjectMapper objectMapper;

    private final AtomicInteger sequence = new AtomicInteger();

    private Member leader;
    private RosterEntry 강하늘;   // 1마을
    private RosterEntry 김보라;   // 1마을
    private RosterEntry 정미르;   // 2마을
    private RosterEntry 새가족;   // newcomer
    private RosterEntry 마을없음;  // village = null

    @BeforeEach
    void setUp() {
        entryRepository.deleteAllInBatch();
        sessionRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();
        rosterRepository.deleteAllInBatch();
        sequence.set(0);

        // 이름 순서를 일부러 뒤섞어 둔다 — 정렬이 실제로 동작하는지 보려면
        정미르 = roster("정미르", "2");
        새가족 = roster("한새봄", "newcomer");
        김보라 = roster("김보라", "1");
        마을없음 = roster("최미지", null);
        강하늘 = roster("강하늘", "1");

        leader = member("시드임원", Role.LEADER);
    }

    // ── §13.2 회차 생성 ───────────────────────────────────────

    @Nested
    @DisplayName("회차 생성")
    class CreateSession {

        @Test
        @DisplayName("만들면 201과 id가 온다")
        void 생성() throws Exception {
            mockMvc.perform(json(post("/api/attendance/sessions"),
                            Map.of("date", "2026-08-30", "type", "SUNDAY_SERVICE", "title", "주일예배")))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.data.id").isString());

            assertThat(sessionRepository.findAll()).singleElement().satisfies(s -> {
                assertThat(s.getDate()).isEqualTo(LocalDate.of(2026, 8, 30));
                assertThat(s.getType()).isEqualTo(AttendanceSessionType.SUNDAY_SERVICE);
                // 누가 만들었는지 남는다
                assertThat(s.getCreatedBy().getId()).isEqualTo(leader.getId());
            });
        }

        @Test
        @DisplayName("★ 같은 날짜 + 같은 종류는 두 번 만들 수 없다 — 출결이 갈라진다")
        void 중복_회차() throws Exception {
            createSession("2026-08-30", "SUNDAY_SERVICE");

            mockMvc.perform(json(post("/api/attendance/sessions"),
                            Map.of("date", "2026-08-30", "type", "SUNDAY_SERVICE", "title", "주일예배")))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.error.code").value("DUPLICATE"))
                    .andExpect(jsonPath("$.error.field").value("date"));

            assertThat(sessionRepository.count()).isEqualTo(1);
        }

        @Test
        @DisplayName("같은 날짜라도 종류가 다르면 만들 수 있다")
        void 같은_날_다른_종류() throws Exception {
            createSession("2026-08-30", "SUNDAY_SERVICE");

            mockMvc.perform(json(post("/api/attendance/sessions"),
                            Map.of("date", "2026-08-30", "type", "ETC", "title", "특별집회")))
                    .andExpect(status().isCreated());

            assertThat(sessionRepository.count()).isEqualTo(2);
        }

        @Test
        @DisplayName("날짜 형식이 틀리면 400")
        void 잘못된_날짜() throws Exception {
            mockMvc.perform(json(post("/api/attendance/sessions"),
                            Map.of("date", "2026/08/30", "type", "SUNDAY_SERVICE", "title", "주일예배")))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
        }

        @Test
        @DisplayName("이름이 비면 400")
        void 빈_이름() throws Exception {
            mockMvc.perform(json(post("/api/attendance/sessions"),
                            Map.of("date", "2026-08-30", "type", "SUNDAY_SERVICE", "title", "  ")))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.field").value("title"));
        }
    }

    // ── §13.3 상세 ────────────────────────────────────────────

    @Nested
    @DisplayName("회차 상세")
    class SessionDetail {

        @Test
        @DisplayName("★ 명단 전원이 내려온다 — 체크된 사람만이 아니다")
        void 명단_전원() throws Exception {
            String id = createSession("2026-08-30", "SUNDAY_SERVICE");
            check(id, 강하늘, "PRESENT");

            mockMvc.perform(get("/api/attendance/sessions/" + id).with(as(leader)))
                    .andExpect(status().isOk())
                    // 5명 전원. 체크 화면이 명단을 훑으며 찍는 방식이다
                    .andExpect(jsonPath("$.data.entries.length()").value(5));
        }

        @Test
        @DisplayName("★ 체크하지 않은 사람은 status가 null이다 — ABSENT가 아니다")
        void 기록_없음은_null() throws Exception {
            String id = createSession("2026-08-30", "SUNDAY_SERVICE");
            check(id, 강하늘, "PRESENT");
            check(id, 김보라, "ABSENT");

            String body = mockMvc.perform(get("/api/attendance/sessions/" + id).with(as(leader)))
                    .andExpect(status().isOk())
                    .andReturn().getResponse().getContentAsString();

            var entries = objectMapper.readTree(body).path("data").path("entries");
            assertThat(statusOf(entries, 강하늘)).isEqualTo("PRESENT");
            assertThat(statusOf(entries, 김보라)).isEqualTo("ABSENT");
            // ★ 결석으로 기록된 사람과 아무도 체크하지 않은 사람은 다르다
            assertThat(statusOf(entries, 정미르)).isNull();
        }

        @Test
        @DisplayName("★ 정렬은 마을 → 이름. newcomer는 뒤, 마을 미지정은 맨 뒤")
        void 정렬() throws Exception {
            String id = createSession("2026-08-30", "SUNDAY_SERVICE");

            mockMvc.perform(get("/api/attendance/sessions/" + id).with(as(leader)))
                    .andExpect(status().isOk())
                    // 1마을(강하늘·김보라) → 2마을(정미르) → newcomer(한새봄) → 미지정(최미지)
                    .andExpect(jsonPath("$.data.entries[0].name").value("강하늘"))
                    .andExpect(jsonPath("$.data.entries[1].name").value("김보라"))
                    .andExpect(jsonPath("$.data.entries[2].name").value("정미르"))
                    .andExpect(jsonPath("$.data.entries[3].name").value("한새봄"))
                    .andExpect(jsonPath("$.data.entries[4].name").value("최미지"));
        }

        @Test
        @DisplayName("★ 마을 미지정도 목록에 남는다 — 빼면 아무도 그 사람을 체크할 수 없다")
        void 마을_미지정도_체크_대상() throws Exception {
            String id = createSession("2026-08-30", "SUNDAY_SERVICE");

            mockMvc.perform(get("/api/attendance/sessions/" + id).with(as(leader)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.entries[4].name").value("최미지"))
                    .andExpect(jsonPath("$.data.entries[4].village").value(
                            org.hamcrest.Matchers.nullValue()));
        }

        @Test
        @DisplayName("⚠️ 전화번호·생년월일이 응답에 없다 — 민감 정보다")
        void 개인정보를_싣지_않는다() throws Exception {
            String id = createSession("2026-08-30", "SUNDAY_SERVICE");

            String body = mockMvc.perform(get("/api/attendance/sessions/" + id).with(as(leader)))
                    .andReturn().getResponse().getContentAsString();

            assertThat(body)
                    .doesNotContain("phone").doesNotContain("birthDate")
                    .doesNotContain("010-");
        }

        @Test
        @DisplayName("없는 회차는 404")
        void 없는_회차() throws Exception {
            mockMvc.perform(get("/api/attendance/sessions/999999").with(as(leader)))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("비활성 명단은 빠진다 — 전출한 사람을 계속 체크하지 않는다")
        void 비활성은_제외() throws Exception {
            RosterEntry left = roster("떠난사람", "1");
            left.deactivate();
            rosterRepository.saveAndFlush(left);

            String id = createSession("2026-08-30", "SUNDAY_SERVICE");

            mockMvc.perform(get("/api/attendance/sessions/" + id).with(as(leader)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.entries.length()").value(5));
        }
    }

    // ── §13.4 출결 upsert ─────────────────────────────────────

    @Nested
    @DisplayName("출결 기록")
    class UpsertEntries {

        @Test
        @DisplayName("배열이 곧 본문이다 — envelope가 없다")
        void 배열_본문() throws Exception {
            String id = createSession("2026-08-30", "SUNDAY_SERVICE");

            mockMvc.perform(put("/api/attendance/sessions/" + id + "/entries")
                            .with(as(leader))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(List.of(
                                    Map.of("rosterId", String.valueOf(강하늘.getId()), "status", "PRESENT"),
                                    Map.of("rosterId", String.valueOf(김보라.getId()), "status", "LATE")))))
                    .andExpect(status().isNoContent());

            assertThat(entryRepository.findAll()).hasSize(2);
        }

        @Test
        @DisplayName("★ upsert다 — 보낸 것만 덮고 나머지는 그대로 둔다")
        void 전체_교체가_아니다() throws Exception {
            String id = createSession("2026-08-30", "SUNDAY_SERVICE");

            // 1마을 임원이 자기 마을을 체크한다
            check(id, 강하늘, "PRESENT");
            check(id, 김보라, "PRESENT");

            // 2마을 임원이 자기 마을만 체크한다 (강하늘·김보라는 보내지 않는다)
            check(id, 정미르, "ABSENT");

            String body = mockMvc.perform(get("/api/attendance/sessions/" + id).with(as(leader)))
                    .andReturn().getResponse().getContentAsString();
            var entries = objectMapper.readTree(body).path("data").path("entries");

            // ★ 전체 교체로 구현했다면 1마을 기록이 사라졌을 것이다
            assertThat(statusOf(entries, 강하늘)).isEqualTo("PRESENT");
            assertThat(statusOf(entries, 김보라)).isEqualTo("PRESENT");
            assertThat(statusOf(entries, 정미르)).isEqualTo("ABSENT");
        }

        @Test
        @DisplayName("같은 사람을 다시 보내면 덮어쓴다 — 행이 늘지 않는다")
        void 덮어쓰기() throws Exception {
            String id = createSession("2026-08-30", "SUNDAY_SERVICE");
            check(id, 강하늘, "ABSENT");
            check(id, 강하늘, "PRESENT");

            assertThat(entryRepository.findAll()).singleElement()
                    .satisfies(e -> assertThat(e.getStatus()).isEqualTo(AttendanceStatus.PRESENT));
        }

        @Test
        @DisplayName("명단에 없는 대상이면 400")
        void 없는_명단() throws Exception {
            String id = createSession("2026-08-30", "SUNDAY_SERVICE");

            mockMvc.perform(put("/api/attendance/sessions/" + id + "/entries")
                            .with(as(leader))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(List.of(
                                    Map.of("rosterId", "999999", "status", "PRESENT")))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                    .andExpect(jsonPath("$.error.field").value("rosterId"));
        }

        @Test
        @DisplayName("없는 회차면 404")
        void 없는_회차() throws Exception {
            mockMvc.perform(put("/api/attendance/sessions/999999/entries")
                            .with(as(leader))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(List.of(
                                    Map.of("rosterId", String.valueOf(강하늘.getId()), "status", "PRESENT")))))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("빈 배열도 204 — 아무것도 바꾸지 않는다")
        void 빈_배열() throws Exception {
            String id = createSession("2026-08-30", "SUNDAY_SERVICE");

            mockMvc.perform(put("/api/attendance/sessions/" + id + "/entries")
                            .with(as(leader))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("[]"))
                    .andExpect(status().isNoContent());
        }
    }

    // ── §13.1 목록 집계 ───────────────────────────────────────

    @Nested
    @DisplayName("목록")
    class Listing {

        @Test
        @DisplayName("★ 집계 세 개가 함께 나온다 — 화면이 '체크 4/15'를 보여준다")
        void 집계() throws Exception {
            String id = createSession("2026-08-30", "SUNDAY_SERVICE");
            check(id, 강하늘, "PRESENT");
            check(id, 김보라, "PRESENT");
            check(id, 정미르, "ABSENT");   // 체크됐지만 PRESENT는 아니다

            mockMvc.perform(get("/api/attendance/sessions").with(as(leader)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.items[0].checkedCount").value(3))
                    .andExpect(jsonPath("$.data.items[0].presentCount").value(2))
                    .andExpect(jsonPath("$.data.items[0].rosterCount").value(5));
        }

        @Test
        @DisplayName("아무도 체크하지 않은 회차는 0/0이다 — 집계가 비어도 터지지 않는다")
        void 체크_없는_회차() throws Exception {
            createSession("2026-08-30", "SUNDAY_SERVICE");

            mockMvc.perform(get("/api/attendance/sessions").with(as(leader)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.items[0].checkedCount").value(0))
                    .andExpect(jsonPath("$.data.items[0].presentCount").value(0))
                    .andExpect(jsonPath("$.data.items[0].rosterCount").value(5));
        }

        @Test
        @DisplayName("날짜 내림차순이다 — 최근 회차를 먼저 본다")
        void 정렬() throws Exception {
            createSession("2026-08-16", "SUNDAY_SERVICE");
            createSession("2026-08-30", "SUNDAY_SERVICE");
            createSession("2026-08-23", "SUNDAY_SERVICE");

            mockMvc.perform(get("/api/attendance/sessions").with(as(leader)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.items[0].date").value("2026-08-30"))
                    .andExpect(jsonPath("$.data.items[1].date").value("2026-08-23"))
                    .andExpect(jsonPath("$.data.items[2].date").value("2026-08-16"));
        }

        @Test
        @DisplayName("회차가 없으면 빈 목록이다 — 404가 아니다")
        void 빈_목록() throws Exception {
            mockMvc.perform(get("/api/attendance/sessions").with(as(leader)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.items").isEmpty());
        }
    }

    // ── §13.5 삭제 ────────────────────────────────────────────

    @Test
    @DisplayName("회차를 지우면 출결 기록도 함께 사라진다")
    void 삭제() throws Exception {
        String id = createSession("2026-08-30", "SUNDAY_SERVICE");
        check(id, 강하늘, "PRESENT");
        assertThat(entryRepository.count()).isEqualTo(1);

        mockMvc.perform(delete("/api/attendance/sessions/" + id).with(as(leader)))
                .andExpect(status().isNoContent());

        assertThat(sessionRepository.count()).isZero();
        assertThat(entryRepository.count()).isZero();
    }

    // ── 보조 ──────────────────────────────────────────────────

    private String statusOf(com.fasterxml.jackson.databind.JsonNode entries, RosterEntry roster) {
        for (var e : entries) {
            if (e.path("rosterId").asText().equals(String.valueOf(roster.getId()))) {
                return e.path("status").isNull() ? null : e.path("status").asText();
            }
        }
        throw new AssertionError("명단에 없다: " + roster.getName());
    }

    private String createSession(String date, String type) throws Exception {
        String body = mockMvc.perform(json(post("/api/attendance/sessions"),
                        Map.of("date", date, "type", type, "title", "회차 " + date)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).path("data").path("id").asText();
    }

    private void check(String sessionId, RosterEntry roster, String status) throws Exception {
        mockMvc.perform(put("/api/attendance/sessions/" + sessionId + "/entries")
                        .with(as(leader))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(List.of(
                                Map.of("rosterId", String.valueOf(roster.getId()), "status", status)))))
                .andExpect(status().isNoContent());
    }

    private RosterEntry roster(String name, String village) {
        int n = sequence.incrementAndGet();
        String phone = "010-2222-%04d".formatted(n);
        return rosterRepository.saveAndFlush(RosterEntry.builder()
                .name(name)
                .birthDate(LocalDate.of(2000, 1, 1).plusDays(n))
                .phoneNormalized(phone.replaceAll("\\D", ""))
                .phoneDisplay(phone)
                .village(village)
                .active(true)
                .build());
    }

    private Member member(String name, Role role) {
        return memberRepository.saveAndFlush(Member.builder()
                .name(name)
                .loginId("actor" + sequence.incrementAndGet())
                .role(role)
                .build());
    }

    private RequestPostProcessor as(Member actor) {
        AuthPrincipal principal = new AuthPrincipal(actor.getId(), actor.getRole());
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities());
        return authentication(authentication);
    }

    /** 기본 주체는 {@link #leader}다 */
    private MockHttpServletRequestBuilder json(
            MockHttpServletRequestBuilder builder, Map<String, Object> body) throws Exception {
        return builder.with(as(leader))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body));
    }
}
