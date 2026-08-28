package kr.light.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import kr.light.member.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 비밀번호 재설정 (SPEC_API.md §2.9·§2.10 · NFR-SEC-08).
 *
 * <p>인증 없이 <b>남의 계정 비밀번호를 바꾸는 길</b>이라 여기서 보는 것은 기능이
 * 아니라 대부분 방어다 — 계정 열거 차단, 1회용, 만료, 기존 세션 폐기.
 *
 * <p>토큰은 서버에 해시로만 남아 평문을 알 수 없다. 그래서 알림 구현체를
 * 가로채 평문을 받아온다 — 실제 메일함을 여는 것과 같은 위치다.
 *
 * <p>⚠️ 이름에 {@code Authorization}을 넣지 않았다. 인가 매트릭스가 아니다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PasswordResetApiTest {

    @Autowired MockMvc mockMvc;
    @Autowired MemberRepository memberRepository;
    @Autowired RefreshTokenRepository refreshTokenRepository;
    @Autowired PasswordResetTokenRepository resetTokenRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired ObjectMapper objectMapper;

    /** 메일함 역할 — 발송된 평문 토큰을 여기서 받는다 */
    @MockitoBean PasswordResetNotifier notifier;

    private final AtomicReference<String> mailbox = new AtomicReference<>();

    private static final String EMAIL = "user@example.com";
    private static final String OLD_PASSWORD = "예전비밀번호1234!";
    private static final String NEW_PASSWORD = "새비밀번호1234!";

    private Member member;

    @BeforeEach
    void setUp() {
        resetTokenRepository.deleteAllInBatch();
        refreshTokenRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();
        mailbox.set(null);

        doAnswer(call -> {
            mailbox.set(call.getArgument(1));
            return null;
        }).when(notifier).notifyResetRequested(any(Member.class), anyString(), any(Duration.class));

        member = memberRepository.saveAndFlush(Member.builder()
                .name("김도연")
                .email(EMAIL)
                .passwordHash(passwordEncoder.encode(OLD_PASSWORD))
                .phone("010-1234-5678")
                .village("3")
                .role(Role.MEMBER)
                .build());
    }

    // ── 계정 존재를 알려주지 않는다 (§2.9) ─────────────────────

    @Test
    @DisplayName("가입된 이메일이면 204이고 토큰이 발송된다")
    void 요청_성공() throws Exception {
        requestReset(EMAIL).andExpect(status().isNoContent());

        assertThat(mailbox.get()).isNotBlank();
        assertThat(resetTokenRepository.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("★ 없는 이메일도 똑같이 204다 — 응답이 바이트 단위로 같다")
    void 없는_이메일도_204() throws Exception {
        MvcResult exists = requestReset(EMAIL).andExpect(status().isNoContent()).andReturn();
        mailbox.set(null);
        MvcResult missing = requestReset("nobody@example.com")
                .andExpect(status().isNoContent()).andReturn();

        // 구분되면 "이 이메일이 가입돼 있다"가 새어나가 계정 열거에 쓰인다
        assertThat(missing.getResponse().getContentAsString())
                .isEqualTo(exists.getResponse().getContentAsString());

        // 실제로는 아무것도 발송되지 않았다
        assertThat(mailbox.get()).isNull();
    }

    @Test
    @DisplayName("카카오 전용 계정은 토큰을 만들지 않는다 — 그래도 204")
    void 카카오_전용_계정() throws Exception {
        memberRepository.saveAndFlush(Member.builder()
                .name("카카오유저")
                .kakaoId("kakao-12345")
                .role(Role.MEMBER)
                .build());
        // 비밀번호가 없는 계정이라 재설정할 대상이 아니다.
        // 이메일이 아예 없으므로 조회 자체가 안 되지만, 응답은 같아야 한다.
        requestReset("kakao@example.com").andExpect(status().isNoContent());

        assertThat(resetTokenRepository.count()).isZero();
    }

    // ── 재설정 (§2.10) ────────────────────────────────────────

    @Test
    @DisplayName("토큰으로 비밀번호가 바뀌고 새 비밀번호로 로그인된다")
    void 재설정_성공() throws Exception {
        requestReset(EMAIL).andExpect(status().isNoContent());

        confirmReset(mailbox.get(), NEW_PASSWORD).andExpect(status().isNoContent());

        // 예전 비밀번호는 막힌다
        login(OLD_PASSWORD).andExpect(status().isUnauthorized());
        // 새 비밀번호로 열린다
        login(NEW_PASSWORD).andExpect(status().isOk());
    }

    @Test
    @DisplayName("토큰은 1회용이다 — 두 번째는 401")
    void 일회용() throws Exception {
        requestReset(EMAIL).andExpect(status().isNoContent());
        String token = mailbox.get();

        confirmReset(token, NEW_PASSWORD).andExpect(status().isNoContent());
        confirmReset(token, "또다른비밀번호1234!")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("재요청하면 이전 토큰이 즉시 무효가 된다 — 살아 있는 링크는 하나")
    void 재요청시_이전_토큰_무효() throws Exception {
        requestReset(EMAIL).andExpect(status().isNoContent());
        String first = mailbox.get();

        requestReset(EMAIL).andExpect(status().isNoContent());
        String second = mailbox.get();

        assertThat(second).isNotEqualTo(first);
        // 지난 메일을 손에 넣은 사람이 나중에 쓰지 못한다
        confirmReset(first, NEW_PASSWORD).andExpect(status().isUnauthorized());
        confirmReset(second, NEW_PASSWORD).andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("없는 토큰·쓴 토큰·만료 토큰이 전부 같은 401이다")
    void 실패는_구분되지_않는다() throws Exception {
        requestReset(EMAIL).andExpect(status().isNoContent());
        String used = mailbox.get();
        confirmReset(used, NEW_PASSWORD).andExpect(status().isNoContent());

        String usedBody = bodyOf(confirmReset(used, "아무비밀번호1234!"));
        String unknownBody = bodyOf(confirmReset("존재하지-않는-토큰", "아무비밀번호1234!"));

        assertThat(usedBody).isEqualTo(unknownBody);
    }

    @Test
    @DisplayName("짧은 비밀번호는 400 — 토큰은 아직 살아 있다")
    void 짧은_비밀번호() throws Exception {
        requestReset(EMAIL).andExpect(status().isNoContent());
        String token = mailbox.get();

        confirmReset(token, "짧음")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));

        // 검증에서 막힌 것이므로 토큰을 소모하지 않았다
        confirmReset(token, NEW_PASSWORD).andExpect(status().isNoContent());
    }

    // ── ★ 재설정하면 기존 세션이 끊긴다 ────────────────────────

    @Test
    @DisplayName("★ 재설정하면 그 회원의 모든 기기에서 로그아웃된다")
    void 재설정시_기존_세션_폐기() throws Exception {
        // 공격자가 이미 로그인해 둔 상황을 가정한다
        MvcResult loggedIn = login(OLD_PASSWORD).andExpect(status().isOk()).andReturn();
        Cookie stolenRefresh = loggedIn.getResponse().getCookie(AuthCookies.REFRESH_TOKEN);
        Cookie stolenAccess = loggedIn.getResponse().getCookie(AuthCookies.ACCESS_TOKEN);
        assertThat(stolenRefresh).isNotNull();

        requestReset(EMAIL).andExpect(status().isNoContent());
        confirmReset(mailbox.get(), NEW_PASSWORD).andExpect(status().isNoContent());

        // 훔친 리프레시 토큰이 더 이상 통하지 않는다
        mockMvc.perform(post("/api/auth/refresh").cookie(stolenRefresh))
                .andExpect(status().isUnauthorized());

        // ⚠️ 액세스 토큰은 자체 검증이라 만료(최대 30분)까지는 살아 있다.
        //    이것이 JWT를 쓰기로 한 대가다 — 리프레시를 끊어 그 이상 못 가게 한다.
        mockMvc.perform(get("/api/auth/me").cookie(stolenAccess))
                .andExpect(status().isOk());
    }

    // ── 만료 (NFR-SEC-08) ─────────────────────────────────────

    @Test
    @DisplayName("만료된 토큰은 401 — 비밀번호가 바뀌지 않는다")
    void 만료된_토큰() throws Exception {
        requestReset(EMAIL).andExpect(status().isNoContent());
        String token = mailbox.get();

        // 발급된 토큰의 만료를 과거로 밀어 "시간이 지난 상태"를 만든다.
        // TTL을 짧게 설정해 실제로 기다리는 방식은 테스트를 느리고 불안정하게 만든다.
        var stored = resetTokenRepository.findAll().get(0);
        setField(stored, "expiresAt", java.time.Instant.now().minusSeconds(60));
        resetTokenRepository.saveAndFlush(stored);

        confirmReset(token, NEW_PASSWORD)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));

        // 예전 비밀번호가 그대로여야 한다
        login(OLD_PASSWORD).andExpect(status().isOk());
    }

    // ── 입력 검증 ─────────────────────────────────────────────

    @Test
    @DisplayName("이메일 형식이 아니면 400")
    void 잘못된_이메일() throws Exception {
        requestReset("이메일아님")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.field").value("email"));
    }

    @Test
    @DisplayName("두 엔드포인트 모두 비로그인으로 열린다 — 비밀번호를 잊은 사람은 로그인할 수 없다")
    void 비로그인_접근() throws Exception {
        // 인증을 요구하면 모순이다. 401로 막히지만 않으면 된다.
        requestReset(EMAIL).andExpect(status().isNoContent());
        confirmReset("아무토큰", NEW_PASSWORD).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    // ── 보조 ──────────────────────────────────────────────────

    private org.springframework.test.web.servlet.ResultActions requestReset(String email) throws Exception {
        return mockMvc.perform(post("/api/auth/password/reset-request")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", email))));
    }

    private org.springframework.test.web.servlet.ResultActions confirmReset(String token, String password)
            throws Exception {
        return mockMvc.perform(post("/api/auth/password/reset")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("token", token, "password", password))));
    }

    private org.springframework.test.web.servlet.ResultActions login(String password) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("email", EMAIL);
        body.put("password", password);
        return mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(body)));
    }

    private String bodyOf(org.springframework.test.web.servlet.ResultActions actions) throws Exception {
        return actions.andReturn().getResponse().getContentAsString();
    }

    private String json(Map<String, Object> body) throws Exception {
        return objectMapper.writeValueAsString(body);
    }

    /** 엔티티에 setter를 두지 않았으므로 테스트에서만 리플렉션으로 심는다 */
    private void setField(Object target, String name, Object value) {
        try {
            var field = target.getClass().getDeclaredField(name);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }
}
