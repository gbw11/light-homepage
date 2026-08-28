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
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 가입 → 로그인 → 재발급 → 로그아웃 관통 (SPEC_API.md §2.1~§2.5).
 *
 * <p>Security 필터 체인을 그대로 태운다. 쿠키가 실제로 심기고, 그 쿠키로 보호
 * 엔드포인트가 열리고, 로그아웃하면 다시 막히는지를 본다 — 하나라도 어긋나면
 * FE는 로그인을 붙일 수 없다.
 *
 * <p>⚠️ 이름에 {@code Authorization}을 넣지 않았다. 인가 매트릭스는
 * {@link AuthAuthorizationTest}다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthApiTest {

    @Autowired MockMvc mockMvc;
    @Autowired MemberRepository memberRepository;
    @Autowired RefreshTokenRepository refreshTokenRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired ObjectMapper objectMapper;

    private static final String EMAIL = "user@example.com";
    private static final String PASSWORD = "비밀번호1234!";

    @BeforeEach
    void setUp() {
        refreshTokenRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();
    }

    // ── 가입 ──────────────────────────────────────────────────

    @Test
    @DisplayName("가입하면 PENDING으로 시작하고 비밀번호는 해시로 저장된다")
    void 가입() throws Exception {
        mockMvc.perform(json(post("/api/auth/signup"), signupForm()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").isString())
                .andExpect(jsonPath("$.data.role").value("PENDING"));

        Member saved = memberRepository.findByEmail(EMAIL).orElseThrow();
        assertThat(saved.getRole()).isEqualTo(Role.PENDING);
        assertThat(saved.getName()).isEqualTo("김도연");
        // ★ 평문이 저장되면 안 된다
        assertThat(saved.getPasswordHash()).isNotEqualTo(PASSWORD);
        assertThat(passwordEncoder.matches(PASSWORD, saved.getPasswordHash())).isTrue();
    }

    @Test
    @DisplayName("가입 응답에 비밀번호가 새어나가지 않는다")
    void 가입_응답에_비밀번호_없음() throws Exception {
        MvcResult result = mockMvc.perform(json(post("/api/auth/signup"), signupForm()))
                .andExpect(status().isCreated())
                .andReturn();

        assertThat(result.getResponse().getContentAsString())
                .doesNotContain(PASSWORD)
                .doesNotContain("passwordHash");
    }

    @Test
    @DisplayName("이메일이 중복이면 DUPLICATE이고 어느 칸인지 알려준다")
    void 이메일_중복() throws Exception {
        mockMvc.perform(json(post("/api/auth/signup"), signupForm()))
                .andExpect(status().isCreated());

        mockMvc.perform(json(post("/api/auth/signup"), signupForm()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("DUPLICATE"))
                .andExpect(jsonPath("$.error.field").value("email"));
    }

    @Test
    @DisplayName("대소문자만 다른 이메일도 같은 계정으로 본다")
    void 이메일_대소문자() throws Exception {
        mockMvc.perform(json(post("/api/auth/signup"), signupForm()))
                .andExpect(status().isCreated());

        Map<String, Object> upper = signupForm();
        upper.put("email", "USER@Example.com");

        mockMvc.perform(json(post("/api/auth/signup"), upper))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("DUPLICATE"));
    }

    @Test
    @DisplayName("동의하지 않으면 저장되지 않는다")
    void 미동의() throws Exception {
        Map<String, Object> form = signupForm();
        form.put("agreed", false);

        mockMvc.perform(json(post("/api/auth/signup"), form))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.field").value("agreed"));

        assertThat(memberRepository.count()).isZero();
    }

    @Test
    @DisplayName("가입 요청으로 역할을 올릴 수 없다")
    void 역할_주입_방지() throws Exception {
        Map<String, Object> form = signupForm();
        form.put("role", "PASTOR");   // 모르는 필드는 무시돼야 한다

        mockMvc.perform(json(post("/api/auth/signup"), form))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.role").value("PENDING"));

        assertThat(memberRepository.findByEmail(EMAIL).orElseThrow().getRole())
                .isEqualTo(Role.PENDING);
    }

    // ── 로그인 ────────────────────────────────────────────────

    @Test
    @DisplayName("로그인하면 두 쿠키가 httpOnly로 심긴다")
    void 로그인_쿠키() throws Exception {
        signUpAndApprove();

        mockMvc.perform(json(post("/api/auth/login"), loginForm()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("김도연"))
                .andExpect(jsonPath("$.data.role").value("MEMBER"))
                .andExpect(jsonPath("$.data.profileComplete").value(true))
                .andExpect(cookie().exists(AuthCookies.ACCESS_TOKEN))
                .andExpect(cookie().exists(AuthCookies.REFRESH_TOKEN))
                // ★ JS가 읽으면 XSS 한 번에 털린다
                .andExpect(cookie().httpOnly(AuthCookies.ACCESS_TOKEN, true))
                .andExpect(cookie().httpOnly(AuthCookies.REFRESH_TOKEN, true))
                // 리프레시는 refresh 엔드포인트에만 실린다
                .andExpect(cookie().path(AuthCookies.REFRESH_TOKEN, AuthCookies.REFRESH_PATH));
    }

    @Test
    @DisplayName("리프레시 쿠키 경로가 refresh와 logout 양쪽에 닿는다")
    void 리프레시_쿠키_경로() {
        // ⚠️ MockMvc는 쿠키 경로를 무시하고 실어 보낸다. 그래서 경로를 잘못 좁혀도
        //    다른 테스트는 전부 통과한다 — 실제 브라우저에서만 로그아웃이 깨진다.
        //    (경로를 /api/auth/refresh로 뒀다가 실제로 그 사고가 났다.)
        //    값 자체를 직접 확인하는 수밖에 없다.
        assertThat("/api/auth/refresh").startsWith(AuthCookies.REFRESH_PATH);
        assertThat("/api/auth/logout").startsWith(AuthCookies.REFRESH_PATH);

        // 그렇다고 "/"로 열어두면 매 요청에 리프레시 토큰이 딸려 다닌다
        assertThat(AuthCookies.REFRESH_PATH).isNotEqualTo("/");
    }

    @Test
    @DisplayName("응답 본문에는 토큰이 없다")
    void 본문에_토큰_없음() throws Exception {
        signUpAndApprove();

        MvcResult result = mockMvc.perform(json(post("/api/auth/login"), loginForm()))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).doesNotContain("token").doesNotContain("eyJ");
    }

    @Test
    @DisplayName("비밀번호가 틀리면 401 — 이메일 없음과 구분되지 않는다")
    void 로그인_실패는_구분되지_않는다() throws Exception {
        signUpAndApprove();

        Map<String, Object> wrongPassword = loginForm();
        wrongPassword.put("password", "틀린비밀번호1!");
        String wrongPwBody = errorBodyOf(json(post("/api/auth/login"), wrongPassword));

        Map<String, Object> noSuchEmail = loginForm();
        noSuchEmail.put("email", "nobody@example.com");
        String noEmailBody = errorBodyOf(json(post("/api/auth/login"), noSuchEmail));

        // 두 응답이 같아야 계정 열거를 막을 수 있다
        assertThat(wrongPwBody).isEqualTo(noEmailBody);
    }

    @Test
    @DisplayName("승인 대기(PENDING)도 로그인은 성공한다 — FE가 /pending으로 보낸다")
    void 미승인_로그인() throws Exception {
        signUp();   // 승인하지 않는다

        mockMvc.perform(json(post("/api/auth/login"), loginForm()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.role").value("PENDING"))
                .andExpect(cookie().exists(AuthCookies.ACCESS_TOKEN));
    }

    // ── 보호 엔드포인트 ────────────────────────────────────────

    @Test
    @DisplayName("로그인 쿠키로 /me가 열린다")
    void me() throws Exception {
        signUpAndApprove();
        Cookie access = loginAndGet(AuthCookies.ACCESS_TOKEN);

        mockMvc.perform(get("/api/auth/me").cookie(access))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value(EMAIL))
                .andExpect(jsonPath("$.data.phone").value("010-1234-5678"))
                .andExpect(jsonPath("$.data.village").value("3"))
                .andExpect(jsonPath("$.data.role").value("MEMBER"))
                .andExpect(jsonPath("$.data.id").isString());
    }

    @Test
    @DisplayName("쿠키 없이 /me는 401이고 계약된 봉투로 나간다")
    void me_미인증() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("위조된 쿠키로는 열리지 않는다")
    void me_위조쿠키() throws Exception {
        signUpAndApprove();

        mockMvc.perform(get("/api/auth/me")
                        .cookie(new Cookie(AuthCookies.ACCESS_TOKEN, "위조된.토큰.값")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    // ── 재발급 · 로그아웃 ──────────────────────────────────────

    @Test
    @DisplayName("리프레시 쿠키로 두 토큰이 새로 발급된다")
    void refresh() throws Exception {
        signUpAndApprove();
        Cookie refresh = loginAndGet(AuthCookies.REFRESH_TOKEN);

        mockMvc.perform(post("/api/auth/refresh").cookie(refresh))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.refreshed").value(true))
                .andExpect(cookie().exists(AuthCookies.ACCESS_TOKEN))
                .andExpect(cookie().exists(AuthCookies.REFRESH_TOKEN));
    }

    @Test
    @DisplayName("리프레시 토큰은 회전한다 — 같은 토큰을 두 번 쓰면 두 번째는 401")
    void refresh_회전() throws Exception {
        signUpAndApprove();
        Cookie refresh = loginAndGet(AuthCookies.REFRESH_TOKEN);

        mockMvc.perform(post("/api/auth/refresh").cookie(refresh))
                .andExpect(status().isOk());

        // 탈취된 토큰이 재사용되는 상황
        mockMvc.perform(post("/api/auth/refresh").cookie(refresh))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("리프레시 쿠키가 없으면 401")
    void refresh_쿠키없음() throws Exception {
        mockMvc.perform(post("/api/auth/refresh"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("로그아웃하면 쿠키가 지워지고 그 리프레시 토큰은 더 못 쓴다")
    void logout() throws Exception {
        signUpAndApprove();
        Cookie refresh = loginAndGet(AuthCookies.REFRESH_TOKEN);

        mockMvc.perform(post("/api/auth/logout").cookie(refresh))
                .andExpect(status().isNoContent())
                .andExpect(cookie().maxAge(AuthCookies.ACCESS_TOKEN, 0))
                .andExpect(cookie().maxAge(AuthCookies.REFRESH_TOKEN, 0));

        mockMvc.perform(post("/api/auth/refresh").cookie(refresh))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("쿠키 없이 로그아웃해도 204 — 실패할 이유가 없는 동작이다")
    void logout_쿠키없음() throws Exception {
        mockMvc.perform(post("/api/auth/logout"))
                .andExpect(status().isNoContent());
    }

    // ── 보조 ──────────────────────────────────────────────────

    private Map<String, Object> signupForm() {
        Map<String, Object> form = new HashMap<>();
        form.put("name", "김도연");
        form.put("email", EMAIL);
        form.put("password", PASSWORD);
        form.put("phone", "010-1234-5678");
        form.put("village", "3");
        form.put("agreed", true);
        return form;
    }

    private Map<String, Object> loginForm() {
        Map<String, Object> form = new HashMap<>();
        form.put("email", EMAIL);
        form.put("password", PASSWORD);
        return form;
    }

    private void signUp() throws Exception {
        mockMvc.perform(json(post("/api/auth/signup"), signupForm()))
                .andExpect(status().isCreated());
    }

    /** 가입 후 MEMBER로 올린다. 승인 API는 M2의 뒷 항목이라 직접 바꾼다. */
    private void signUpAndApprove() throws Exception {
        signUp();
        Member member = memberRepository.findByEmail(EMAIL).orElseThrow();
        setField(member, "role", Role.MEMBER);
        memberRepository.saveAndFlush(member);
    }

    private Cookie loginAndGet(String name) throws Exception {
        MvcResult result = mockMvc.perform(json(post("/api/auth/login"), loginForm()))
                .andExpect(status().isOk())
                .andReturn();
        Cookie cookie = result.getResponse().getCookie(name);
        assertThat(cookie).as("%s 쿠키가 없다", name).isNotNull();
        return cookie;
    }

    private String errorBodyOf(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request)
            throws Exception {
        return mockMvc.perform(request)
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder json(
            org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder builder,
            Map<String, Object> body) throws Exception {
        return builder.contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body));
    }

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
