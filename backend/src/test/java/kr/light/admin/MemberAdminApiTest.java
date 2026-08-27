package kr.light.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import kr.light.auth.AuthPrincipal;
import kr.light.auth.RefreshTokenRepository;
import kr.light.common.AuditLogRepository;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import kr.light.member.Role;
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

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 회원 승인·거절·역할 부여의 실제 동작 (SPEC_API.md §8.1~§8.4).
 *
 * <p>인가는 {@link MemberAdminAuthorizationTest}가 덮는다. 여기서는 전도사로
 * 로그인한 뒤 <b>무엇이 실제로 바뀌는가</b>를 본다 — 역할, 승인 기록, 감사로그,
 * 그리고 자기잠금 방지.
 *
 * <p>⚠️ 이름에 {@code Authorization}을 넣지 않았다. 인가 매트릭스가 아니다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MemberAdminApiTest {

    @Autowired MockMvc mockMvc;
    @Autowired MemberRepository memberRepository;
    @Autowired RefreshTokenRepository refreshTokenRepository;
    @Autowired AuditLogRepository auditLogRepository;
    @Autowired ObjectMapper objectMapper;

    private Member pastor;

    @BeforeEach
    void setUp() {
        auditLogRepository.deleteAllInBatch();
        refreshTokenRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();

        pastor = save("전도사", "pastor@light.kr", Role.PASTOR);
    }

    // ── 승인 (§8.2) ───────────────────────────────────────────

    @Test
    @DisplayName("승인하면 MEMBER가 되고 승인자·시각이 남는다")
    void 승인() throws Exception {
        Member pending = save("김도연", "pending@light.kr", Role.PENDING);

        mockMvc.perform(post("/api/admin/members/" + pending.getId() + "/approve").with(as(pastor)))
                .andExpect(status().isNoContent());

        Member approved = memberRepository.findById(pending.getId()).orElseThrow();
        assertThat(approved.getRole()).isEqualTo(Role.MEMBER);
        assertThat(approved.getApprovedAt()).isNotNull();
        assertThat(approved.getApprovedBy().getId()).isEqualTo(pastor.getId());
    }

    @Test
    @DisplayName("승인은 감사로그에 남는다")
    void 승인_감사로그() throws Exception {
        Member pending = save("김도연", "pending@light.kr", Role.PENDING);

        mockMvc.perform(post("/api/admin/members/" + pending.getId() + "/approve").with(as(pastor)))
                .andExpect(status().isNoContent());

        assertThat(auditLogRepository.findAll())
                .singleElement()
                .satisfies(log -> {
                    assertThat(log.getAction()).isEqualTo("MEMBER_APPROVE");
                    assertThat(log.getTarget()).isEqualTo("member:" + pending.getId());
                    assertThat(log.getActor().getId()).isEqualTo(pastor.getId());
                });
    }

    @Test
    @DisplayName("이미 승인된 회원을 다시 승인하면 400 — 최초 승인 시각을 덮지 않는다")
    void 중복_승인() throws Exception {
        Member member = save("김도연", "member@light.kr", Role.MEMBER);

        mockMvc.perform(post("/api/admin/members/" + member.getId() + "/approve").with(as(pastor)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    @DisplayName("없는 회원을 승인하면 404")
    void 없는_회원_승인() throws Exception {
        mockMvc.perform(post("/api/admin/members/999999/approve").with(as(pastor)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
    }

    // ── 거절 (§8.3) ───────────────────────────────────────────

    @Test
    @DisplayName("거절하면 회원 행이 삭제되고 사유가 감사로그에 남는다")
    void 거절() throws Exception {
        Member pending = save("김도연", "pending@light.kr", Role.PENDING);

        mockMvc.perform(post("/api/admin/members/" + pending.getId() + "/reject")
                        .with(as(pastor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("reason", "청년교회 소속 확인 불가"))))
                .andExpect(status().isNoContent());

        // 개인정보가 남지 않는다
        assertThat(memberRepository.findById(pending.getId())).isEmpty();

        // 사유가 유일한 기록이다
        assertThat(auditLogRepository.findAll())
                .singleElement()
                .satisfies(log -> {
                    assertThat(log.getAction()).isEqualTo("MEMBER_REJECT");
                    assertThat(log.getDetail()).isEqualTo("청년교회 소속 확인 불가");
                });
    }

    @Test
    @DisplayName("사유 없이 거절할 수 없다 — 기록이 남지 않기 때문")
    void 거절_사유_필수() throws Exception {
        Member pending = save("김도연", "pending@light.kr", Role.PENDING);

        mockMvc.perform(post("/api/admin/members/" + pending.getId() + "/reject")
                        .with(as(pastor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("reason", "  "))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.field").value("reason"));

        assertThat(memberRepository.findById(pending.getId())).isPresent();
    }

    @Test
    @DisplayName("활동 중인 회원은 거절할 수 없다 — 그건 탈퇴의 몫이다")
    void 승인된_회원은_거절_불가() throws Exception {
        Member member = save("김도연", "member@light.kr", Role.MEMBER);

        mockMvc.perform(post("/api/admin/members/" + member.getId() + "/reject")
                        .with(as(pastor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("reason", "실수"))))
                .andExpect(status().isBadRequest());

        assertThat(memberRepository.findById(member.getId())).isPresent();
    }

    // ── 역할 변경 (§8.4) ──────────────────────────────────────

    @Test
    @DisplayName("MEMBER를 LEADER로 올리고 변경 내역이 남는다")
    void 역할_변경() throws Exception {
        Member member = save("김도연", "member@light.kr", Role.MEMBER);

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
        Member leader = save("김도연", "leader@light.kr", Role.LEADER);

        mockMvc.perform(patch("/api/admin/members/" + leader.getId() + "/role")
                        .with(as(pastor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("role", "MEMBER"))))
                .andExpect(status().isNoContent());

        assertThat(memberRepository.findById(leader.getId()).orElseThrow().getRole())
                .isEqualTo(Role.MEMBER);
    }

    @Test
    @DisplayName("PENDING을 역할 변경으로 끌어올릴 수 없다 — 승인 기록을 건너뛰게 된다")
    void 미승인은_역할변경_불가() throws Exception {
        Member pending = save("김도연", "pending@light.kr", Role.PENDING);

        mockMvc.perform(patch("/api/admin/members/" + pending.getId() + "/role")
                        .with(as(pastor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("role", "MEMBER"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));

        assertThat(memberRepository.findById(pending.getId()).orElseThrow().getRole())
                .isEqualTo(Role.PENDING);
    }

    @Test
    @DisplayName("PASTOR는 API로 부여할 수 없다")
    void 전도사_부여_불가() throws Exception {
        Member member = save("김도연", "member@light.kr", Role.MEMBER);

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
    @DisplayName("★ 마지막 전도사는 강등할 수 없다 — 아무도 승인할 수 없게 된다")
    void 마지막_전도사_강등_거부() throws Exception {
        // pastor가 유일한 PASTOR다
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
        Member second = save("전도사2", "pastor2@light.kr", Role.PASTOR);
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
    @DisplayName("기본은 승인 대기만 보여준다")
    void 목록_기본() throws Exception {
        save("대기중", "p1@light.kr", Role.PENDING);
        save("회원", "m1@light.kr", Role.MEMBER);

        mockMvc.perform(get("/api/admin/members").with(as(pastor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].name").value("대기중"))
                .andExpect(jsonPath("$.data.items[0].role").value("PENDING"))
                .andExpect(jsonPath("$.data.items[0].id").isString());
    }

    @Test
    @DisplayName("status=ALL이면 전체를 보여준다")
    void 목록_전체() throws Exception {
        save("대기중", "p1@light.kr", Role.PENDING);
        save("회원", "m1@light.kr", Role.MEMBER);

        mockMvc.perform(get("/api/admin/members").param("status", "ALL").with(as(pastor)))
                .andExpect(status().isOk())
                // 전도사 본인까지 3명
                .andExpect(jsonPath("$.data.items.length()").value(3));
    }

    @Test
    @DisplayName("이름으로 검색한다 — 대소문자를 구분하지 않는다")
    void 목록_검색() throws Exception {
        save("Kim Doyeon", "k1@light.kr", Role.PENDING);
        save("박도연", "p2@light.kr", Role.PENDING);

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

    private Member save(String name, String email, Role role) {
        return memberRepository.saveAndFlush(Member.builder()
                .name(name)
                .email(email)
                .phone("010-1234-5678")
                .village("3")
                .role(role)
                .build());
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
