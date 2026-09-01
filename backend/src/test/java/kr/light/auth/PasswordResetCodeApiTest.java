package kr.light.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
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

import kr.light.common.ApiException;
import kr.light.common.ErrorCode;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 리셋 코드로 비밀번호 재설정 (SPEC_API.md §8.4 → §2.9).
 *
 * <p><b>인증 없이 남의 계정 비밀번호를 바꾸는 길</b>이라, 여기서 보는 것은
 * 기능이 아니라 대부분 방어다 — 1회용, 만료, 코드와 아이디의 주인 일치,
 * 실패 응답의 동일성, 성공 시 기존 세션 폐기.
 *
 * <p>본인 확인의 근거가 시스템이 아니라 <b>전도사의 판단</b>이라는 점이
 * 이 기능의 성격을 결정한다. 그래서 발급이 감사로그에 남는지도 여기서 본다.
 *
 * <p>⚠️ 이름에 {@code Authorization}을 넣지 않았다. 인가 매트릭스는
 * {@link kr.light.admin.MemberAdminAuthorizationTest}가 덮는다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PasswordResetCodeApiTest {

    @Autowired MockMvc mockMvc;
    @Autowired MemberRepository memberRepository;
    @Autowired RosterEntryRepository rosterRepository;
    @Autowired PasswordResetTokenRepository tokenRepository;
    @Autowired RefreshTokenRepository refreshTokenRepository;
    @Autowired LoginAttemptRepository loginAttemptRepository;
    @Autowired kr.light.common.AuditLogRepository auditLogRepository;
    @Autowired PasswordResetService passwordResetService;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired ObjectMapper objectMapper;

    private static final String LOGIN_ID = "doyeon01";
    private static final String OLD_PASSWORD = "예전비밀번호1234!";
    private static final String NEW_PASSWORD = "새비밀번호1234!";

    private final AtomicInteger sequence = new AtomicInteger();

    private Member pastor;
    private Member member;

    @BeforeEach
    void setUp() {
        auditLogRepository.deleteAllInBatch();
        tokenRepository.deleteAllInBatch();
        refreshTokenRepository.deleteAllInBatch();
        loginAttemptRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();
        rosterRepository.deleteAllInBatch();
        sequence.set(0);

        pastor = save("전도사", "pastor", Role.PASTOR);
        member = save("김도연a", LOGIN_ID, Role.MEMBER);
    }

    // ── 발급 (§8.4) ───────────────────────────────────────────

    @Nested
    @DisplayName("발급")
    class Issue {

        @Test
        @DisplayName("전도사가 발급하면 평문 코드와 만료 시각이 나온다")
        void 발급() throws Exception {
            mockMvc.perform(post(resetPath()).with(as(pastor)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.resetCode").isString())
                    .andExpect(jsonPath("$.data.expiresAt").isString());
        }

        @Test
        @DisplayName("★ 코드는 헷갈리는 글자를 쓰지 않는다 — 입으로 전하는 값이다")
        void 헷갈리는_글자를_쓰지_않는다() throws Exception {
            // 0/O, 1/I/L은 말로도 글자로도 구별되지 않는다. 100번 뽑아 확인한다
            for (int i = 0; i < 100; i++) {
                assertThat(ResetCodes.generate())
                        .matches("[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}")
                        .doesNotContain("0").doesNotContain("O")
                        .doesNotContain("1").doesNotContain("I").doesNotContain("L");
            }
        }

        @Test
        @DisplayName("★ 평문은 저장되지 않는다 — DB를 읽어도 코드를 알 수 없다")
        void 평문은_저장되지_않는다() throws Exception {
            String code = issueCode();

            assertThat(tokenRepository.findAll()).singleElement()
                    .satisfies(token -> assertThat(token.getTokenHash())
                            .isNotEqualTo(code)
                            .doesNotContain(ResetCodes.normalize(code)));
        }

        @Test
        @DisplayName("★ 발급이 감사로그에 남는다 — 본인 확인의 근거가 사람의 판단이다")
        void 발급은_감사로그에_남는다() throws Exception {
            String code = issueCode();

            assertThat(auditLogRepository.findAll()).singleElement().satisfies(log -> {
                assertThat(log.getAction()).isEqualTo("PASSWORD_RESET_ISSUE");
                assertThat(log.getTarget()).isEqualTo("member:" + member.getId());
                // ⚠️ 코드 자체는 로그에 남으면 안 된다
                assertThat(log.getDetail()).doesNotContain(code);
            });
        }

        @Test
        @DisplayName("다시 발급하면 이전 코드는 무효가 된다 — 살아 있는 코드는 하나뿐")
        void 재발급은_이전_코드를_무효화한다() throws Exception {
            String first = issueCode();
            issueCode();

            mockMvc.perform(json(post("/api/auth/password/reset-with-code"), resetForm(first)))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("★ 카카오 전용 계정에는 발급하지 않는다 — 받아도 쓸 수 없다")
        void 카카오_계정은_발급_불가() throws Exception {
            Member kakao = memberRepository.saveAndFlush(Member.builder()
                    .name("카카오회원")
                    .kakaoId("kakao-123")
                    .role(Role.MEMBER)
                    .build());

            // §2.9는 loginId로 대조하는데 그 계정에는 loginId가 없다.
            // 발급하면 전도사가 "줬는데 안 된다"를 겪는다.
            mockMvc.perform(post("/api/admin/members/" + kakao.getId() + "/password/reset")
                            .with(as(pastor)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
        }

        @Test
        @DisplayName("없는 회원에게 발급하면 404")
        void 없는_회원() throws Exception {
            mockMvc.perform(post("/api/admin/members/999999/password/reset").with(as(pastor)))
                    .andExpect(status().isNotFound());
        }
    }

    // ── 사용 (§2.9) ───────────────────────────────────────────

    @Nested
    @DisplayName("사용")
    class Use {

        @Test
        @DisplayName("코드로 비밀번호를 바꾸고 새 비밀번호로 로그인된다")
        void 재설정() throws Exception {
            String code = issueCode();

            mockMvc.perform(json(post("/api/auth/password/reset-with-code"), resetForm(code)))
                    .andExpect(status().isNoContent());

            Member updated = memberRepository.findByLoginId(LOGIN_ID).orElseThrow();
            assertThat(passwordEncoder.matches(NEW_PASSWORD, updated.getPasswordHash())).isTrue();
            assertThat(passwordEncoder.matches(OLD_PASSWORD, updated.getPasswordHash())).isFalse();

            mockMvc.perform(json(post("/api/auth/login"),
                            Map.of("loginId", LOGIN_ID, "password", NEW_PASSWORD)))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("로그인 없이 쓸 수 있다 — 비밀번호를 잊은 사람은 로그인할 수 없다")
        void 인증_없이_열려_있다() throws Exception {
            String code = issueCode();

            // 401(필터에 막힘)이 아니라 204여야 한다
            mockMvc.perform(json(post("/api/auth/password/reset-with-code"), resetForm(code)))
                    .andExpect(status().isNoContent());
        }

        @Test
        @DisplayName("★ 대소문자·하이픈을 가리지 않는다 — 입으로 전달받아 옮겨 적는 값이다")
        void 표기_흔들림을_흡수한다() throws Exception {
            String code = issueCode();

            mockMvc.perform(json(post("/api/auth/password/reset-with-code"),
                            resetForm(code.toLowerCase().replace("-", " "))))
                    .andExpect(status().isNoContent());
        }

        @Test
        @DisplayName("★ 1회용이다 — 같은 코드를 두 번 쓸 수 없다")
        void 코드는_1회용() throws Exception {
            String code = issueCode();

            mockMvc.perform(json(post("/api/auth/password/reset-with-code"), resetForm(code)))
                    .andExpect(status().isNoContent());

            mockMvc.perform(json(post("/api/auth/password/reset-with-code"), resetForm(code)))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("★ 코드만으로는 안 된다 — 아이디가 그 코드의 주인이어야 한다")
        void 코드의_주인이_아니면_거부한다() throws Exception {
            Member other = save("이서준", "seojun01", Role.MEMBER);
            String codeForMember = issueCode();

            // 어디선가 흘러나온 코드 하나로 아무 계정이나 열 수 있으면 안 된다
            Map<String, Object> form = resetForm(codeForMember);
            form.put("loginId", "seojun01");

            mockMvc.perform(json(post("/api/auth/password/reset-with-code"), form))
                    .andExpect(status().isUnauthorized());

            assertThat(passwordEncoder.matches(
                    NEW_PASSWORD,
                    memberRepository.findById(other.getId()).orElseThrow().getPasswordHash()))
                    .isFalse();
        }

        @Test
        @DisplayName("★ 실패 이유를 구분해 주지 않는다 — 세 응답이 완전히 같다")
        void 실패_응답이_같다() throws Exception {
            issueCode();

            String wrongCode = errorBodyOf(resetForm("ZZZZ-ZZZZ"));
            String noSuchLoginId = errorBodyOf(withLoginId(resetForm("ZZZZ-ZZZZ"), "nobody99"));

            String usedCode = issueCode();
            mockMvc.perform(json(post("/api/auth/password/reset-with-code"), resetForm(usedCode)))
                    .andExpect(status().isNoContent());
            String reused = errorBodyOf(resetForm(usedCode));

            assertThat(wrongCode).isEqualTo(noSuchLoginId).isEqualTo(reused);
        }

        @Test
        @DisplayName("★ 성공하면 모든 기기에서 로그아웃된다")
        void 기존_세션이_폐기된다() throws Exception {
            // 다른 기기에서 로그인해 둔 상태
            var loginResult = mockMvc.perform(json(post("/api/auth/login"),
                            Map.of("loginId", LOGIN_ID, "password", OLD_PASSWORD)))
                    .andExpect(status().isOk())
                    .andReturn();
            var refreshCookie = loginResult.getResponse().getCookie(AuthCookies.REFRESH_TOKEN);
            assertThat(refreshCookie).isNotNull();

            String code = issueCode();
            mockMvc.perform(json(post("/api/auth/password/reset-with-code"), resetForm(code)))
                    .andExpect(status().isNoContent());

            // 재설정하는 상황은 계정이 남의 손에 있을지도 모른다는 뜻이다.
            // 기존 세션을 살려두면 비밀번호를 바꾼 의미가 사라진다.
            mockMvc.perform(post("/api/auth/refresh").cookie(refreshCookie))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("★ 30분이 지나면 만료된다")
        void 만료된다() throws Exception {
            String code = issueCode();

            // HTTP로는 30분을 기다릴 수 없다. 서비스는 now를 인자로 받으므로
            // 시계를 앞으로 돌려 확인한다 — 실제 만료 판단과 같은 경로다.
            Instant later = Instant.now().plus(Duration.ofMinutes(31));

            assertThatThrownBy(() -> passwordResetService.resetWithCode(
                    LOGIN_ID, code, NEW_PASSWORD, later))
                    .isInstanceOf(ApiException.class)
                    .extracting(e -> ((ApiException) e).code())
                    .isEqualTo(ErrorCode.UNAUTHORIZED);

            // 만료 직전에는 통과한다 — 30분이 실제로 30분이어야 한다
            assertThatCode(() -> passwordResetService.resetWithCode(
                    LOGIN_ID, code, NEW_PASSWORD, Instant.now().plus(Duration.ofMinutes(29))))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("한글 긴 비밀번호가 500이 되지 않는다 — 가입과 같은 바이트 검사")
        void 긴_한글_비밀번호() throws Exception {
            String code = issueCode();

            Map<String, Object> form = resetForm(code);
            form.put("password", "가".repeat(30));   // 90바이트

            mockMvc.perform(json(post("/api/auth/password/reset-with-code"), form))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.field").value("password"));
        }
    }

    // ── 보조 ──────────────────────────────────────────────────

    private String resetPath() {
        return "/api/admin/members/" + member.getId() + "/password/reset";
    }

    private String issueCode() throws Exception {
        String body = mockMvc.perform(post(resetPath()).with(as(pastor)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).path("data").path("resetCode").asText();
    }

    private Map<String, Object> resetForm(String code) {
        Map<String, Object> form = new HashMap<>();
        form.put("loginId", LOGIN_ID);
        form.put("resetCode", code);
        form.put("password", NEW_PASSWORD);
        return form;
    }

    private Map<String, Object> withLoginId(Map<String, Object> form, String loginId) {
        form.put("loginId", loginId);
        return form;
    }

    private String errorBodyOf(Map<String, Object> form) throws Exception {
        return mockMvc.perform(json(post("/api/auth/password/reset-with-code"), form))
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();
    }

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

        Member saved = memberRepository.saveAndFlush(Member.builder()
                .name(name)
                .loginId(loginId)
                .phone(phone)
                .passwordHash(passwordEncoder.encode(OLD_PASSWORD))
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

    private MockHttpServletRequestBuilder json(
            MockHttpServletRequestBuilder builder, Map<String, Object> body) throws Exception {
        return builder.contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body));
    }
}
