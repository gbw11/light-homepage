package kr.light.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import kr.light.auth.AuthPrincipal;
import kr.light.auth.RefreshTokenRepository;
import kr.light.common.AuditLogRepository;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import kr.light.member.Role;
import kr.light.roster.RosterEntry;
import kr.light.roster.RosterEntryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 회원 목록·계정 삭제·역할 부여의 실제 동작 (SPEC_API.md §8.1~§8.3).
 *
 * <p>인가는 {@link MemberAdminAuthorizationTest}가 덮는다. 여기서는 전도사로
 * 로그인한 뒤 <b>무엇이 실제로 바뀌는가</b>를 본다 — 역할, 감사로그,
 * 명단 재개방, 그리고 자기잠금 방지.
 *
 * <p>~~승인·거절~~ 은 v1.3에서 폐기됐다. 명단 대조가 본인 확인을 대신하므로
 * 승인 절차가 없고, 거절 대신 <b>계정 삭제 + 명단 재개방</b>(§8.2)이 있다.
 *
 * <p>⚠️ 이름에 {@code Authorization}을 넣지 않았다. 인가 매트릭스가 아니다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MemberAdminApiTest {

    @Autowired MockMvc mockMvc;
    @Autowired MemberRepository memberRepository;
    @Autowired RosterEntryRepository rosterRepository;
    @Autowired RefreshTokenRepository refreshTokenRepository;
    @Autowired AuditLogRepository auditLogRepository;
    @Autowired ObjectMapper objectMapper;

    @PersistenceContext EntityManager entityManager;

    /** 명단 행을 서로 다르게 만들기 위한 카운터 */
    private final AtomicInteger sequence = new AtomicInteger();

    private Member pastor;

    @BeforeEach
    void setUp() {
        auditLogRepository.deleteAllInBatch();
        refreshTokenRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();
        rosterRepository.deleteAllInBatch();
        sequence.set(0);

        pastor = save("전도사", "pastor", Role.PASTOR);
    }

    // ── 계정 삭제 + 명단 재개방 (§8.2) ─────────────────────────

    @Test
    @DisplayName("삭제하면 회원 행이 사라지고 사유가 감사로그에 남는다")
    void 삭제() throws Exception {
        Member member = save("김도연a", "doyeon01", Role.MEMBER);

        mockMvc.perform(delete("/api/admin/members/" + member.getId())
                        .with(as(pastor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("reason", "본인 확인 — 선점 계정 삭제"))))
                .andExpect(status().isNoContent());

        assertThat(memberRepository.findById(member.getId())).isEmpty();
        assertThat(auditLogRepository.findAll())
                .singleElement()
                .satisfies(log -> {
                    assertThat(log.getAction()).isEqualTo("MEMBER_DELETE");
                    assertThat(log.getDetail()).isEqualTo("본인 확인 — 선점 계정 삭제");
                });
    }

    @Test
    @DisplayName("★ 삭제하면 명단이 다시 열려 본인이 가입할 수 있다 — 선점 복구의 핵심")
    void 삭제하면_명단이_열린다() throws Exception {
        Member member = save("김도연a", "doyeon01", Role.MEMBER);
        RosterEntry claimed = rosterRepository.findByClaimedById(member.getId()).orElseThrow();
        assertThat(claimed.isClaimable()).isFalse();

        mockMvc.perform(delete("/api/admin/members/" + member.getId())
                        .with(as(pastor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("reason", "본인 확인 — 선점 계정 삭제"))))
                .andExpect(status().isNoContent());

        // 1차 캐시를 비우고 DB에서 다시 읽는다
        entityManager.clear();
        assertThat(rosterRepository.findById(claimed.getId()))
                .get()
                .satisfies(entry -> assertThat(entry.isClaimable()).isTrue());
    }

    @Test
    @DisplayName("사유 없이 삭제할 수 없다 — 감사로그가 유일한 기록이기 때문")
    void 삭제_사유_필수() throws Exception {
        Member member = save("김도연a", "doyeon01", Role.MEMBER);

        mockMvc.perform(delete("/api/admin/members/" + member.getId())
                        .with(as(pastor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("reason", "  "))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));

        assertThat(memberRepository.findById(member.getId())).isPresent();
    }

    @Test
    @DisplayName("★ 자기 계정은 삭제할 수 없다 — 아무도 회원을 관리할 수 없게 된다")
    void 자기_계정은_삭제_불가() throws Exception {
        mockMvc.perform(delete("/api/admin/members/" + pastor.getId())
                        .with(as(pastor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("reason", "실수"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.field").value("id"));

        assertThat(memberRepository.findById(pastor.getId())).isPresent();
    }

    @Test
    @DisplayName("없는 회원을 삭제하면 404")
    void 없는_회원_삭제() throws Exception {
        mockMvc.perform(delete("/api/admin/members/999999")
                        .with(as(pastor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("reason", "테스트"))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
    }

    // ── 역할 변경 (§8.3) ──────────────────────────────────────

    @Test
    @DisplayName("MEMBER를 LEADER로 올리고 변경 내역이 남는다")
    void 역할_변경() throws Exception {
        Member member = save("김도연a", "doyeon01", Role.MEMBER);

        mockMvc.perform(patch("/api/admin/members/" + member.getId() + "/role")
                        .with(as(pastor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("role", "LEADER"))))
                .andExpect(status().isNoContent());

        assertThat(memberRepository.findById(member.getId()).orElseThrow().getRole())
                .isEqualTo(Role.LEADER);

        assertThat(auditLogRepository.findAll())
                .singleElement()
                .satisfies(log -> {
                    assertThat(log.getAction()).isEqualTo("ROLE_CHANGE");
                    assertThat(log.getDetail()).isEqualTo("MEMBER → LEADER");
                });
    }

    @Test
    @DisplayName("LEADER를 MEMBER로 되돌릴 수 있다")
    void 역할_강등() throws Exception {
        Member leader = save("이서준", "seojun01", Role.LEADER);

        mockMvc.perform(patch("/api/admin/members/" + leader.getId() + "/role")
                        .with(as(pastor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("role", "MEMBER"))))
                .andExpect(status().isNoContent());

        assertThat(memberRepository.findById(leader.getId()).orElseThrow().getRole())
                .isEqualTo(Role.MEMBER);
    }

    @Test
    @DisplayName("PASTOR는 API로 부여할 수 없다")
    void 전도사_부여_불가() throws Exception {
        Member member = save("김도연a", "doyeon01", Role.MEMBER);

        mockMvc.perform(patch("/api/admin/members/" + member.getId() + "/role")
                        .with(as(pastor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("role", "PASTOR"))))
                .andExpect(status().isBadRequest());

        assertThat(memberRepository.findById(member.getId()).orElseThrow().getRole())
                .isEqualTo(Role.MEMBER);
    }

    // ── 자기잠금 방지 (§5.4 · FR-ADM-05) ──────────────────────

    @Test
    @DisplayName("★ 마지막 전도사는 강등할 수 없다 — 아무도 회원을 관리할 수 없게 된다")
    void 마지막_전도사_강등_거부() throws Exception {
        assertThat(memberRepository.countByRole(Role.PASTOR)).isEqualTo(1);

        mockMvc.perform(patch("/api/admin/members/" + pastor.getId() + "/role")
                        .with(as(pastor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("role", "MEMBER"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.field").value("role"));

        assertThat(memberRepository.findById(pastor.getId()).orElseThrow().getRole())
                .isEqualTo(Role.PASTOR);
    }

    @Test
    @DisplayName("전도사가 둘이어도 강등은 막힌다 — PASTOR는 API로 다루지 않는다")
    void 전도사가_둘일_때() throws Exception {
        Member second = save("전도사2", "pastor2", Role.PASTOR);
        assertThat(memberRepository.countByRole(Role.PASTOR)).isEqualTo(2);

        // 자기잠금 검사는 통과하지만 MEMBER↔LEADER 규칙에서 막힌다.
        // PASTOR 강등을 열려면 changeRole의 허용 범위를 먼저 넓혀야 한다.
        mockMvc.perform(patch("/api/admin/members/" + second.getId() + "/role")
                        .with(as(pastor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("role", "MEMBER"))))
                .andExpect(status().isBadRequest());
    }

    // ── 목록 (§8.1) ───────────────────────────────────────────

    @Test
    @DisplayName("목록은 하나뿐이다 — 승인 대기 구분이 사라졌다")
    void 목록() throws Exception {
        save("김도연a", "doyeon01", Role.MEMBER);
        save("이서준", "seojun01", Role.LEADER);

        mockMvc.perform(get("/api/admin/members").with(as(pastor)))
                .andExpect(status().isOk())
                // 전도사 본인까지 3명
                .andExpect(jsonPath("$.data.items.length()").value(3))
                .andExpect(jsonPath("$.data.items[0].id").isString());
    }

    @Test
    @DisplayName("이름은 동명이인 접미사를 포함해 그대로 보여준다")
    void 목록_접미사() throws Exception {
        save("김도연a", "doyeon01", Role.MEMBER);

        mockMvc.perform(get("/api/admin/members").param("q", "김도연").with(as(pastor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].name").value("김도연a"))
                .andExpect(jsonPath("$.data.items[0].loginId").value("doyeon01"));
    }

    @Test
    @DisplayName("이름으로 검색한다 — 대소문자를 구분하지 않는다")
    void 목록_검색() throws Exception {
        save("Kim Doyeon", "kim01", Role.MEMBER);
        save("박도연", "park01", Role.MEMBER);

        mockMvc.perform(get("/api/admin/members").param("q", "kim").with(as(pastor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].name").value("Kim Doyeon"));
    }

    @Test
    @DisplayName("검색 결과가 없으면 빈 목록이다")
    void 목록_빈_결과() throws Exception {
        mockMvc.perform(get("/api/admin/members").param("q", "없는이름").with(as(pastor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items").isEmpty());
    }

    // ── 보조 ──────────────────────────────────────────────────

    /**
     * 명단 행 + 계정을 함께 만든다.
     *
     * <p>계정만 만들면 실제 가입으로는 도달할 수 없는 상태가 되어, §8.2의
     * 명단 재개방 같은 동작을 확인할 수 없다.
     */
    private Member save(String name, String loginId, Role role) {
        int n = sequence.incrementAndGet();
        String phone = "010-0000-%04d".formatted(n);

        RosterEntry roster = rosterRepository.saveAndFlush(RosterEntry.builder()
                .name(name)
                .birthDate(LocalDate.of(2000, 1, 1).plusDays(n))
                .phoneNormalized(phone.replaceAll("\\D", ""))
                .phoneDisplay(phone)
                .active(true)
                .build());

        Member member = memberRepository.saveAndFlush(Member.builder()
                .name(name)
                .loginId(loginId)
                .phone(phone)
                .rosterEntry(roster)
                .role(role)
                .build());

        roster.claimBy(member, Instant.now());
        rosterRepository.saveAndFlush(roster);
        return member;
    }

    private RequestPostProcessor as(Member member) {
        AuthPrincipal principal = new AuthPrincipal(member.getId(), member.getRole());
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities());
        return authentication(authentication);
    }

    private String json(Map<String, Object> body) throws Exception {
        return objectMapper.writeValueAsString(body);
    }
}
