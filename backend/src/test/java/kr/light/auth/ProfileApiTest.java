package kr.light.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import kr.light.common.AuditLogRepository;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 본인이 자기 계정에 하는 일 (SPEC_API.md §2.10 · §2.11 · §2.12).
 *
 * <p>여기서 보는 것의 절반은 <b>명세에 없어서 우리가 정한 판단</b>이다 —
 * 카카오 계정에는 비밀번호가 없고, 마지막 전도사가 나가면 아무도 남지 않으며,
 * 비밀번호를 바꾼 사람이 그 자리에서 튕기면 안 된다. 그 결정들을 여기서 고정한다.
 *
 * <p>⚠️ 이름에 {@code Authorization}을 넣지 않았다. 인가 매트릭스가 아니다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProfileApiTest {

    @Autowired MockMvc mockMvc;
    @Autowired MemberRepository memberRepository;
    @Autowired RosterEntryRepository rosterRepository;
    @Autowired RefreshTokenRepository refreshTokenRepository;
    @Autowired AuditLogRepository auditLogRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired ObjectMapper objectMapper;

    private static final String LOGIN_ID = "doyeon01";
    private static final String PASSWORD = "비밀번호1234!";
    private static final String NEW_PASSWORD = "새비밀번호1234!";

    private final AtomicInteger sequence = new AtomicInteger();

    private Member member;

    @BeforeEach
    void setUp() {
        auditLogRepository.deleteAllInBatch();
        refreshTokenRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();
        rosterRepository.deleteAllInBatch();
        sequence.set(0);

        member = save("김도연a", LOGIN_ID, Role.MEMBER);
    }

    // ── 프로필 수정 (§2.10) ───────────────────────────────────

    @Nested
    @DisplayName("프로필 수정")
    class UpdateProfile {

        @Test
        @DisplayName("연락처를 바꾸면 갱신된 프로필이 나온다")
        void 연락처_변경() throws Exception {
            mockMvc.perform(json(patch("/api/auth/me"), Map.of("phone", "010-9999-8888")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.phone").value("010-9999-8888"))
                    .andExpect(jsonPath("$.data.name").value("김도연a"));
        }

        @Test
        @DisplayName("★ 명단의 전화번호는 바뀌지 않는다 — 대조의 기준이 흔들리면 안 된다")
        void 명단은_바뀌지_않는다() throws Exception {
            String rosterPhone = rosterRepository.findAll().get(0).getPhoneNormalized();

            mockMvc.perform(json(patch("/api/auth/me"), Map.of("phone", "010-9999-8888")))
                    .andExpect(status().isOk());

            // 여기가 바뀌면 §2.1 대조의 기준을 사용자가 고칠 수 있게 되고,
            // §8.2에서 전도사가 본인 확인 전화를 걸 번호도 사라진다
            assertThat(rosterRepository.findAll().get(0).getPhoneNormalized())
                    .isEqualTo(rosterPhone);
        }

        @Test
        @DisplayName("이름은 바꿀 수 없다 — 모르는 필드는 무시된다")
        void 이름은_바꿀_수_없다() throws Exception {
            Map<String, Object> form = new HashMap<>();
            form.put("phone", "010-9999-8888");
            form.put("name", "다른이름");

            mockMvc.perform(json(patch("/api/auth/me"), form))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.name").value("김도연a"));
        }

        @Test
        @DisplayName("로그인하지 않으면 401")
        void 미인증() throws Exception {
            mockMvc.perform(patch("/api/auth/me")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"phone\":\"010-9999-8888\"}"))
                    .andExpect(status().isUnauthorized());
        }
    }

    // ── 비밀번호 변경 (§2.11) ─────────────────────────────────

    @Nested
    @DisplayName("비밀번호 변경")
    class ChangePassword {

        @Test
        @DisplayName("현재 비밀번호가 맞으면 바뀐다")
        void 변경() throws Exception {
            mockMvc.perform(json(post("/api/auth/password/change"),
                            Map.of("currentPassword", PASSWORD, "newPassword", NEW_PASSWORD)))
                    .andExpect(status().isNoContent());

            String hash = memberRepository.findById(member.getId()).orElseThrow().getPasswordHash();
            assertThat(passwordEncoder.matches(NEW_PASSWORD, hash)).isTrue();
            assertThat(passwordEncoder.matches(PASSWORD, hash)).isFalse();
        }

        @Test
        @DisplayName("★ 현재 비밀번호가 틀리면 401이 아니라 400이다")
        void 틀린_현재_비밀번호는_400() throws Exception {
            // 401을 주면 FE의 공통 처리가 "세션이 끊겼다"로 보고 로그인 화면으로
            // 튕긴다. 실제로는 로그인은 멀쩡하고 입력값만 틀린 상황이다.
            mockMvc.perform(json(post("/api/auth/password/change"),
                            Map.of("currentPassword", "틀린비밀번호1!", "newPassword", NEW_PASSWORD)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));

            assertThat(passwordEncoder.matches(
                    PASSWORD, memberRepository.findById(member.getId()).orElseThrow().getPasswordHash()))
                    .isTrue();
        }

        @Test
        @DisplayName("★ 다른 기기의 세션이 끊긴다")
        void 다른_기기가_로그아웃된다() throws Exception {
            Cookie otherDevice = loginAndGetRefreshCookie();

            mockMvc.perform(json(post("/api/auth/password/change"),
                            Map.of("currentPassword", PASSWORD, "newPassword", NEW_PASSWORD)))
                    .andExpect(status().isNoContent());

            // 비밀번호를 바꾸는 이유가 "누가 내 계정을 쓰는 것 같다"인 경우가 많다
            mockMvc.perform(post("/api/auth/refresh").cookie(otherDevice))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("★ 바꾼 기기는 로그인 상태가 유지된다 — 새 쿠키가 함께 나온다")
        void 바꾼_기기는_유지된다() throws Exception {
            var result = mockMvc.perform(json(post("/api/auth/password/change"),
                            Map.of("currentPassword", PASSWORD, "newPassword", NEW_PASSWORD)))
                    .andExpect(status().isNoContent())
                    .andExpect(cookie().exists(AuthCookies.ACCESS_TOKEN))
                    .andExpect(cookie().exists(AuthCookies.REFRESH_TOKEN))
                    .andReturn();

            // 안 그러면 비밀번호를 바꾼 사람이 그 자리에서 튕긴다
            Cookie fresh = result.getResponse().getCookie(AuthCookies.REFRESH_TOKEN);
            mockMvc.perform(post("/api/auth/refresh").cookie(fresh))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("카카오 전용 계정에는 바꿀 비밀번호가 없다")
        void 카카오_계정은_변경_불가() throws Exception {
            Member kakao = memberRepository.saveAndFlush(Member.builder()
                    .name("카카오회원").kakaoId("kakao-1").role(Role.MEMBER).build());

            mockMvc.perform(post("/api/auth/password/change").with(as(kakao))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(
                                    Map.of("currentPassword", "아무거나1234!", "newPassword", NEW_PASSWORD))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
        }

        @Test
        @DisplayName("한글 긴 비밀번호가 500이 되지 않는다")
        void 긴_한글_비밀번호() throws Exception {
            mockMvc.perform(json(post("/api/auth/password/change"),
                            Map.of("currentPassword", PASSWORD, "newPassword", "가".repeat(30))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.field").value("password"));
        }
    }

    // ── 탈퇴 (§2.12) ──────────────────────────────────────────

    @Nested
    @DisplayName("탈퇴")
    class Withdraw {

        @Test
        @DisplayName("비밀번호가 맞으면 계정이 사라지고 쿠키가 지워진다")
        void 탈퇴() throws Exception {
            mockMvc.perform(json(delete("/api/auth/me"), Map.of("password", PASSWORD)))
                    .andExpect(status().isNoContent())
                    .andExpect(cookie().maxAge(AuthCookies.ACCESS_TOKEN, 0))
                    .andExpect(cookie().maxAge(AuthCookies.REFRESH_TOKEN, 0));

            assertThat(memberRepository.findById(member.getId())).isEmpty();
        }

        @Test
        @DisplayName("★ 명단이 다시 열려 재가입할 수 있다")
        void 명단이_다시_열린다() throws Exception {
            RosterEntry claimed = rosterRepository.findByClaimedById(member.getId()).orElseThrow();
            assertThat(claimed.isClaimable()).isFalse();

            mockMvc.perform(json(delete("/api/auth/me"), Map.of("password", PASSWORD)))
                    .andExpect(status().isNoContent());

            // 탈퇴는 "이 서비스를 그만 쓴다"이지 "교회를 떠난다"가 아니다
            assertThat(rosterRepository.findById(claimed.getId()))
                    .get()
                    .satisfies(entry -> assertThat(entry.isClaimable()).isTrue());
        }

        @Test
        @DisplayName("비밀번호가 틀리면 탈퇴되지 않는다")
        void 틀린_비밀번호() throws Exception {
            mockMvc.perform(json(delete("/api/auth/me"), Map.of("password", "틀린비밀번호1!")))
                    .andExpect(status().isBadRequest());

            assertThat(memberRepository.findById(member.getId())).isPresent();
        }

        @Test
        @DisplayName("★ 카카오 계정은 비밀번호 없이 탈퇴한다 — 필수로 두면 못 나간다")
        void 카카오_계정_탈퇴() throws Exception {
            Member kakao = memberRepository.saveAndFlush(Member.builder()
                    .name("카카오회원").kakaoId("kakao-1").role(Role.MEMBER).build());

            mockMvc.perform(delete("/api/auth/me").with(as(kakao)))
                    .andExpect(status().isNoContent());

            assertThat(memberRepository.findById(kakao.getId())).isEmpty();
        }

        @Test
        @DisplayName("★ 마지막 전도사는 탈퇴할 수 없다 — 아무도 남지 않는다")
        void 마지막_전도사() throws Exception {
            Member pastor = save("전도사", "pastor", Role.PASTOR);
            assertThat(memberRepository.countByRole(Role.PASTOR)).isEqualTo(1);

            mockMvc.perform(delete("/api/auth/me").with(as(pastor))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("password", PASSWORD))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                    .andExpect(jsonPath("$.error.field").value("role"));

            assertThat(memberRepository.findById(pastor.getId())).isPresent();
        }

        @Test
        @DisplayName("전도사가 둘이면 한 명은 탈퇴할 수 있다")
        void 전도사가_둘이면_가능() throws Exception {
            save("전도사1", "pastor1", Role.PASTOR);
            Member second = save("전도사2", "pastor2", Role.PASTOR);

            mockMvc.perform(delete("/api/auth/me").with(as(second))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("password", PASSWORD))))
                    .andExpect(status().isNoContent());
        }

        @Test
        @DisplayName("탈퇴가 감사로그에 남는다 — 회원 행은 사라져도 기록은 남는다")
        void 감사로그() throws Exception {
            mockMvc.perform(json(delete("/api/auth/me"), Map.of("password", PASSWORD)))
                    .andExpect(status().isNoContent());

            assertThat(auditLogRepository.findAll()).singleElement().satisfies(log -> {
                assertThat(log.getAction()).isEqualTo("MEMBER_WITHDRAW");
                assertThat(log.getTarget()).isEqualTo("member:" + member.getId());
            });
        }

        @Test
        @DisplayName("탈퇴하면 그 세션으로 아무것도 할 수 없다")
        void 탈퇴_후_세션() throws Exception {
            Cookie refresh = loginAndGetRefreshCookie();

            mockMvc.perform(json(delete("/api/auth/me"), Map.of("password", PASSWORD)))
                    .andExpect(status().isNoContent());

            mockMvc.perform(post("/api/auth/refresh").cookie(refresh))
                    .andExpect(status().isUnauthorized());
            mockMvc.perform(get("/api/auth/me").with(as(member)))
                    .andExpect(status().isUnauthorized());
        }
    }

    // ── 보조 ──────────────────────────────────────────────────

    private Cookie loginAndGetRefreshCookie() throws Exception {
        var result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("loginId", LOGIN_ID, "password", PASSWORD))))
                .andExpect(status().isOk())
                .andReturn();
        Cookie cookie = result.getResponse().getCookie(AuthCookies.REFRESH_TOKEN);
        assertThat(cookie).isNotNull();
        return cookie;
    }

    private Member save(String name, String loginId, Role role) {
        int n = sequence.incrementAndGet();
        String phone = "010-1111-%04d".formatted(n);

        RosterEntry roster = rosterRepository.saveAndFlush(RosterEntry.builder()
                .name(name)
                .birthDate(LocalDate.of(2000, 1, 1).plusDays(n))
                .phoneNormalized(phone.replaceAll("\\D", ""))
                .phoneDisplay(phone)
                .active(true)
                .build());

        Member saved = memberRepository.saveAndFlush(Member.builder()
                .name(name)
                .loginId(loginId)
                .phone(phone)
                .passwordHash(passwordEncoder.encode(PASSWORD))
                .rosterEntry(roster)
                .role(role)
                .build());

        roster.claimBy(saved, Instant.now());
        rosterRepository.saveAndFlush(roster);
        return saved;
    }

    private RequestPostProcessor as(Member actor) {
        AuthPrincipal principal = new AuthPrincipal(actor.getId(), actor.getRole());
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities());
        return authentication(authentication);
    }

    /** 기본 주체는 {@link #member}다 */
    private MockHttpServletRequestBuilder json(
            MockHttpServletRequestBuilder builder, Map<String, Object> body) throws Exception {
        return builder.with(as(member))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body));
    }
}
