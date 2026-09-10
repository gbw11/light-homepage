package kr.light.newcomer;

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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 새가족 신청 목록과 보유기간 정리 (SPEC_API.md §8.6).
 *
 * <p>이 기능의 무게는 조회가 아니라 <b>지우는 쪽</b>에 있다. 이름·전화번호가
 * 든 개인정보이고, 신청 폼에서 보유기간 1년을 고지하고 동의를 받았다 —
 * 지우지 않으면 코드가 약속을 어긴다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class NewcomerAdminApiTest {

    @Autowired MockMvc mockMvc;
    @Autowired NewcomerRepository newcomerRepository;
    @Autowired NewcomerAdminService newcomerAdminService;
    @Autowired MemberRepository memberRepository;
    @Autowired JdbcTemplate jdbcTemplate;

    private Member leader;

    @BeforeEach
    void setUp() {
        newcomerRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();
        leader = memberRepository.saveAndFlush(Member.builder()
                .name("시드임원").loginId("leader").role(Role.LEADER).build());
    }

    // ── 목록 ─────────────────────────────────────────────────

    @Test
    @DisplayName("계약이 정한 필드가 그대로 나온다 (§8.6)")
    void 응답_형태() throws Exception {
        save("김도연", "010-1234-5678", Gender.FEMALE, AgeGroup.EARLY_20S,
                Referrer.FRIEND, "친구 소개로 가보려고요");

        mockMvc.perform(get("/api/admin/newcomers").with(as(leader)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].id").isString())
                .andExpect(jsonPath("$.data.items[0].name").value("김도연"))
                .andExpect(jsonPath("$.data.items[0].phone").value("010-1234-5678"))
                .andExpect(jsonPath("$.data.items[0].gender").value("FEMALE"))
                .andExpect(jsonPath("$.data.items[0].ageGroup").value("EARLY_20S"))
                .andExpect(jsonPath("$.data.items[0].referrer").value("FRIEND"))
                .andExpect(jsonPath("$.data.items[0].message").value("친구 소개로 가보려고요"))
                .andExpect(jsonPath("$.data.items[0].createdAt").isString());
    }

    @Test
    @DisplayName("★ 선택 항목은 null로 나간다 — 빈 문자열로 바꾸지 않는다")
    void 선택_항목() throws Exception {
        // FE 타입이 `Gender | null`이라 빈 문자열을 주면 라벨 조회가 깨진다
        save("이름만", "010-0000-0000", null, null, null, null);

        mockMvc.perform(get("/api/admin/newcomers").with(as(leader)))
                .andExpect(jsonPath("$.data.items[0].gender").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.data.items[0].ageGroup").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.data.items[0].referrer").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.data.items[0].message").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    @DisplayName("최근 신청이 위다 — 새로 온 사람부터 연락한다")
    void 정렬() throws Exception {
        NewcomerRequest old = save("먼저온사람", "010-1111-1111", null, null, null, null);
        backdate(old, Instant.now().minus(3, ChronoUnit.DAYS));
        save("나중온사람", "010-2222-2222", null, null, null, null);

        mockMvc.perform(get("/api/admin/newcomers").with(as(leader)))
                .andExpect(jsonPath("$.data.items[0].name").value("나중온사람"))
                .andExpect(jsonPath("$.data.items[1].name").value("먼저온사람"));
    }

    @Test
    @DisplayName("신청이 없으면 빈 목록이다 — 404가 아니다")
    void 빈_목록() throws Exception {
        mockMvc.perform(get("/api/admin/newcomers").with(as(leader)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items").isEmpty());
    }

    // ── 인가 (§10) ───────────────────────────────────────────

    static Stream<Arguments> roles() {
        return Stream.of(
                arguments(null,        401, "UNAUTHORIZED"),
                // ⚠️ 회원에게 열리면 교인 연락처가 회원 전체에게 열린다
                arguments(Role.MEMBER, 403, "FORBIDDEN"),
                arguments(Role.LEADER, 200, null),
                arguments(Role.PASTOR, 200, null)
        );
    }

    @ParameterizedTest(name = "GET admin/newcomers × {0} → {1}")
    @MethodSource("roles")
    void 인가(Role role, int expectedStatus, String expectedCode) throws Exception {
        var result = mockMvc.perform(withRole(get("/api/admin/newcomers"), role))
                .andExpect(status().is(expectedStatus));

        if (expectedCode != null) {
            result.andExpect(jsonPath("$.error.code").value(expectedCode))
                    .andExpect(jsonPath("$.data").doesNotExist());
        }
    }

    @Test
    @DisplayName("⚠️ 막힌 응답에 이름·전화번호가 새지 않는다")
    void 막힌_응답이_비어_있다() throws Exception {
        save("새면안됨", "010-9999-9999", null, null, null, null);

        String body = mockMvc.perform(get("/api/admin/newcomers"))
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain("새면안됨").doesNotContain("010-9999-9999");
    }

    // ── 보유기간 1년 ─────────────────────────────────────────

    @Test
    @DisplayName("★ 1년 지난 신청은 삭제된다 — 폼에서 고지하고 동의받은 기간이다")
    void 보유기간_만료() {
        NewcomerRequest expired = save("오래된신청", "010-1111-1111", null, null, null, null);
        backdate(expired, Instant.now().minus(366, ChronoUnit.DAYS));

        newcomerAdminService.purgeExpired();

        assertThat(newcomerRepository.count()).isZero();
    }

    @Test
    @DisplayName("★ 1년이 안 된 신청은 남는다")
    void 보유기간_이내() {
        NewcomerRequest recent = save("최근신청", "010-2222-2222", null, null, null, null);
        backdate(recent, Instant.now().minus(364, ChronoUnit.DAYS));

        newcomerAdminService.purgeExpired();

        assertThat(newcomerRepository.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("지울 게 없으면 아무 일도 일어나지 않는다")
    void 만료_없음() {
        save("최근신청", "010-3333-3333", null, null, null, null);

        newcomerAdminService.purgeExpired();

        assertThat(newcomerRepository.count()).isEqualTo(1);
    }

    // ── 보조 ─────────────────────────────────────────────────

    private NewcomerRequest save(String name, String phone, Gender gender,
                                 AgeGroup ageGroup, Referrer referrer, String message) {
        return newcomerRepository.saveAndFlush(NewcomerRequest.builder()
                .name(name)
                .phone(phone)
                .gender(gender)
                .ageGroup(ageGroup)
                .referrer(referrer)
                .message(message)
                .agreedAt(Instant.now())
                .build());
    }

    /**
     * ⚠️ {@code created_at}은 {@code updatable = false}라 엔티티로는 못 바꾼다.
     * DB에서 직접 옮긴다 — 1년을 기다릴 수는 없다.
     */
    private void backdate(NewcomerRequest request, Instant createdAt) {
        jdbcTemplate.update("UPDATE newcomer_requests SET created_at = ? WHERE id = ?",
                Timestamp.from(createdAt), request.getId());
    }

    private MockHttpServletRequestBuilder withRole(MockHttpServletRequestBuilder builder, Role role) {
        if (role == null) {
            return builder;
        }
        Member actor = memberRepository.saveAndFlush(Member.builder()
                .name("행위자")
                .loginId("actor_%s".formatted(role.name().toLowerCase()))
                .role(role)
                .build());
        return builder.with(as(actor));
    }

    private RequestPostProcessor as(Member actor) {
        AuthPrincipal principal = new AuthPrincipal(actor.getId(), actor.getRole());
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities());
        return authentication(authentication);
    }
}
