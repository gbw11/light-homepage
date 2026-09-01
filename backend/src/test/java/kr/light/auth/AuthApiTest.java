package kr.light.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 명단 확인 → 가입 → 로그인 → 재발급 → 로그아웃 관통 (SPEC_API.md §2.1~§2.6).
 *
 * <p>Security 필터 체인을 그대로 태운다. 쿠키가 실제로 심기고, 그 쿠키로 보호
 * 엔드포인트가 열리고, 로그아웃하면 다시 막히는지를 본다 — 하나라도 어긋나면
 * FE는 로그인을 붙일 수 없다.
 *
 * <p><b>가입 쪽 테스트의 절반은 "무엇을 알려주지 않는가"를 본다.</b> 명단 대조는
 * 실패 이유를 구분해 주지 않기로 했고(§2.1), 그 약속이 깨지면 교인 명단을
 * 캐낼 수 있게 된다. 응답 본문을 서로 비교하는 테스트들이 그것이다.
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
    @Autowired RegistrationTokenRepository registrationTokenRepository;
    @Autowired LoginAttemptRepository loginAttemptRepository;
    @Autowired RosterEntryRepository rosterRepository;
    @Autowired VerifyRosterRateLimiter rateLimiter;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired ObjectMapper objectMapper;

    private static final String LOGIN_ID = "doyeon01";
    private static final String PASSWORD = "비밀번호1234!";

    /** 명단의 값. ★ 접미사 {@code a}가 이름의 일부다 */
    private static final String NAME = "김도연a";
    private static final String BIRTH_DATE = "2001-03-14";
    private static final String PHONE = "010-1234-5678";

    @BeforeEach
    void setUp() {
        refreshTokenRepository.deleteAllInBatch();
        registrationTokenRepository.deleteAllInBatch();
        loginAttemptRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();
        rosterRepository.deleteAllInBatch();
        rateLimiter.reset();

        rosterRepository.saveAndFlush(RosterEntry.builder()
                .name(NAME)
                .birthDate(LocalDate.parse(BIRTH_DATE))
                .phoneNormalized("01012345678")
                .phoneDisplay(PHONE)
                .active(true)
                .build());
    }

    // ── 가입 1단계: 명단 확인 ──────────────────────────────────

    @Test
    @DisplayName("명단과 맞으면 5분짜리 1회용 토큰이 나온다")
    void 명단_확인() throws Exception {
        mockMvc.perform(json(post("/api/auth/verify-roster"), verifyForm()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.registrationToken").isString())
                .andExpect(jsonPath("$.data.name").value(NAME))
                .andExpect(jsonPath("$.data.expiresIn").value(300));
    }

    @Test
    @DisplayName("★ 접미사가 빠지면 통과하지 못한다 — 접미사가 이름의 일부다")
    void 접미사는_이름의_일부다() throws Exception {
        Map<String, Object> form = verifyForm();
        form.put("name", "김도연");

        mockMvc.perform(json(post("/api/auth/verify-roster"), form))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("전화번호 표기가 달라도 통과한다 — 숫자만 남겨 비교한다")
    void 전화번호_표기는_자유다() throws Exception {
        Map<String, Object> form = verifyForm();
        form.put("phone", "+82 10 1234 5678");

        mockMvc.perform(json(post("/api/auth/verify-roster"), form))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("★ 어느 필드가 틀렸는지 알려주지 않는다 — 세 응답이 완전히 같다")
    void 실패_이유를_구분하지_않는다() throws Exception {
        // 다르면 값을 하나씩 바꿔가며 "이 조합은 명단에 있다"를 알아낼 수 있고,
        // 그것이 곧 교인 명부다.
        String wrongName = errorBodyOf(verifyWith("name", "없는사람"));
        String wrongBirth = errorBodyOf(verifyWith("birthDate", "1999-01-01"));
        String wrongPhone = errorBodyOf(verifyWith("phone", "010-9999-8888"));

        assertThat(wrongName).isEqualTo(wrongBirth).isEqualTo(wrongPhone);
    }

    @Test
    @DisplayName("★ 이미 계정이 있어도 같은 401이다 — 가입 여부가 새어나가지 않는다")
    void 이미_가입한_사람도_같은_응답() throws Exception {
        String normalFailure = errorBodyOf(verifyWith("name", "없는사람"));
        register();

        assertThat(errorBodyOf(json(post("/api/auth/verify-roster"), verifyForm())))
                .isEqualTo(normalFailure);
    }

    @Test
    @DisplayName("★ 시도 제한을 넘겨도 429가 아니라 같은 401이다")
    void 시도_제한도_같은_응답() throws Exception {
        String normalFailure = errorBodyOf(verifyWith("name", "없는사람"));

        for (int i = 0; i < 12; i++) {
            mockMvc.perform(verifyWith("name", "없는사람"));
        }

        // 맞는 값을 넣어도 막힌다 — 그런데 응답은 일반 실패와 구분되지 않는다.
        // 429를 주면 "지금 막힌 걸 보니 뭔가를 맞히고 있다"는 신호가 된다.
        assertThat(errorBodyOf(json(post("/api/auth/verify-roster"), verifyForm())))
                .isEqualTo(normalFailure);
    }

    // ── 가입 2단계: 계정 생성 ──────────────────────────────────

    @Test
    @DisplayName("가입하면 즉시 MEMBER이고 이름·연락처는 명단에서 온다")
    void 가입() throws Exception {
        mockMvc.perform(json(post("/api/auth/register"), registerForm(verifyAndGetToken())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").isString())
                .andExpect(jsonPath("$.data.name").value(NAME))
                .andExpect(jsonPath("$.data.role").value("MEMBER"));

        Member saved = memberRepository.findByLoginId(LOGIN_ID).orElseThrow();
        assertThat(saved.getRole()).isEqualTo(Role.MEMBER);
        // 사용자가 다시 입력하지 않았다 — 대조한 명단 행에서 왔다
        assertThat(saved.getName()).isEqualTo(NAME);
        assertThat(saved.getPhone()).isEqualTo(PHONE);
        // ★ 평문이 저장되면 안 된다
        assertThat(saved.getPasswordHash()).isNotEqualTo(PASSWORD);
        assertThat(passwordEncoder.matches(PASSWORD, saved.getPasswordHash())).isTrue();
    }

    @Test
    @DisplayName("★ 가입해도 세션 쿠키는 나가지 않는다 — FE가 로그인으로 유도한다")
    void 가입은_로그인시키지_않는다() throws Exception {
        mockMvc.perform(json(post("/api/auth/register"), registerForm(verifyAndGetToken())))
                .andExpect(status().isCreated())
                .andExpect(cookie().doesNotExist(AuthCookies.ACCESS_TOKEN))
                .andExpect(cookie().doesNotExist(AuthCookies.REFRESH_TOKEN));
    }

    @Test
    @DisplayName("★ 토큰은 1회용이다 — 같은 토큰으로 두 번 가입할 수 없다")
    void 토큰은_1회용() throws Exception {
        String token = verifyAndGetToken();
        mockMvc.perform(json(post("/api/auth/register"), registerForm(token)))
                .andExpect(status().isCreated());

        Map<String, Object> second = registerForm(token);
        second.put("loginId", "another01");

        mockMvc.perform(json(post("/api/auth/register"), second))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("명단 확인을 다시 하면 이전 토큰은 무효가 된다 — 살아 있는 증표는 하나뿐")
    void 재확인은_이전_토큰을_무효화한다() throws Exception {
        String first = verifyAndGetToken();
        verifyAndGetToken();

        mockMvc.perform(json(post("/api/auth/register"), registerForm(first)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("아이디가 중복이면 DUPLICATE이고 어느 칸인지 알려준다")
    void 아이디_중복() throws Exception {
        register();

        // 아이디 중복은 알려준다 — 사용자가 방금 정한 값이고, 명단과 달리
        // "이미 쓰이는 아이디다"는 개인정보가 아니다.
        String token = tokenFor("이서준", "2002-05-06", "010-2222-3333");

        mockMvc.perform(json(post("/api/auth/register"), registerForm(token)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("DUPLICATE"))
                .andExpect(jsonPath("$.error.field").value("loginId"));
    }

    @Test
    @DisplayName("★ 생년월일·전화번호를 비밀번호로 쓸 수 없다")
    void 개인정보는_비밀번호가_될_수_없다() throws Exception {
        // 방금 그 두 값을 입력했기에 가장 손이 가지만, 이 서비스에서 그 둘은
        // 본인임을 증명하는 값이다 — 아는 사람이면 비밀번호까지 아는 셈이 된다.
        for (String weak : new String[]{"20010314", "010314", "01012345678"}) {
            Map<String, Object> form = registerForm(verifyAndGetToken());
            form.put("password", weak);

            mockMvc.perform(json(post("/api/auth/register"), form))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                    .andExpect(jsonPath("$.error.field").value("password"));
        }
    }

    @Test
    @DisplayName("★ 한글 긴 비밀번호가 500이 되지 않는다 — BCrypt 한계는 글자가 아니라 바이트다")
    void 긴_한글_비밀번호() throws Exception {
        // @Size(max = 72)는 글자 수를 센다. 한글은 UTF-8에서 3바이트라
        // 25자만 넘어도 BCrypt의 72바이트 한계를 넘어 인코더가 예외를 던진다.
        // 영문으로만 테스트하면 끝까지 드러나지 않는다 — 실서버 확인에서 잡혔다.
        Map<String, Object> form = registerForm(verifyAndGetToken());
        form.put("password", "가".repeat(30));   // 90바이트

        mockMvc.perform(json(post("/api/auth/register"), form))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.field").value("password"));
    }

    @Test
    @DisplayName("영문 72자는 통과한다 — 바이트 기준이라 글자 수로 깎이지 않는다")
    void 영문_긴_비밀번호() throws Exception {
        Map<String, Object> form = registerForm(verifyAndGetToken());
        form.put("password", "a".repeat(72));

        mockMvc.perform(json(post("/api/auth/register"), form))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("가입 요청으로 역할을 올릴 수 없다")
    void 역할_주입_방지() throws Exception {
        Map<String, Object> form = registerForm(verifyAndGetToken());
        form.put("role", "PASTOR");   // 모르는 필드는 무시돼야 한다

        mockMvc.perform(json(post("/api/auth/register"), form))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.role").value("MEMBER"));

        assertThat(memberRepository.findByLoginId(LOGIN_ID).orElseThrow().getRole())
                .isEqualTo(Role.MEMBER);
    }

    @Test
    @DisplayName("가입 응답에 비밀번호가 새어나가지 않는다")
    void 가입_응답에_비밀번호_없음() throws Exception {
        MvcResult result = mockMvc.perform(
                        json(post("/api/auth/register"), registerForm(verifyAndGetToken())))
                .andExpect(status().isCreated())
                .andReturn();

        assertThat(result.getResponse().getContentAsString())
                .doesNotContain(PASSWORD)
                .doesNotContain("passwordHash");
    }

    @Test
    @DisplayName("★ 가입하면 명단이 잠긴다 — 같은 사람으로 두 번 가입할 수 없다")
    void 가입하면_명단이_잠긴다() throws Exception {
        register();

        assertThat(rosterRepository.findAll()).singleElement()
                .satisfies(entry -> assertThat(entry.isClaimable()).isFalse());
    }

    // ── 로그인 ────────────────────────────────────────────────

    @Test
    @DisplayName("로그인하면 두 쿠키가 httpOnly로 심긴다")
    void 로그인_쿠키() throws Exception {
        register();

        mockMvc.perform(json(post("/api/auth/login"), loginForm()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value(NAME))
                .andExpect(jsonPath("$.data.role").value("MEMBER"))
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
        register();

        MvcResult result = mockMvc.perform(json(post("/api/auth/login"), loginForm()))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).doesNotContain("token").doesNotContain("eyJ");
    }

    @Test
    @DisplayName("비밀번호가 틀리면 401 — 없는 아이디와 구분되지 않는다")
    void 로그인_실패는_구분되지_않는다() throws Exception {
        register();

        Map<String, Object> wrongPassword = loginForm();
        wrongPassword.put("password", "틀린비밀번호1!");
        String wrongPwBody = errorBodyOf(json(post("/api/auth/login"), wrongPassword));

        Map<String, Object> noSuchId = loginForm();
        noSuchId.put("loginId", "nobody99");
        String noIdBody = errorBodyOf(json(post("/api/auth/login"), noSuchId));

        // 두 응답이 같아야 계정 열거를 막을 수 있다
        assertThat(wrongPwBody).isEqualTo(noIdBody);
    }

    @Test
    @DisplayName("★ 5회 실패하면 잠긴다 — 맞는 비밀번호로도 들어갈 수 없다")
    void 다섯번_실패하면_잠긴다() throws Exception {
        register();
        failLogin(5);

        mockMvc.perform(json(post("/api/auth/login"), loginForm()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("★ 잠겼다는 사실을 알려주지 않는다 — 응답이 일반 실패와 같다")
    void 잠금은_드러나지_않는다() throws Exception {
        register();

        Map<String, Object> wrong = loginForm();
        wrong.put("password", "틀린비밀번호1!");
        String firstFailure = errorBodyOf(json(post("/api/auth/login"), wrong));

        failLogin(5);

        // "잠겼습니다"는 곧 "이 아이디는 존재합니다"다
        assertThat(errorBodyOf(json(post("/api/auth/login"), loginForm())))
                .isEqualTo(firstFailure);
    }

    @Test
    @DisplayName("성공하면 실패 누적이 지워진다 — 한 번 틀린 사람이 계속 잠기지 않는다")
    void 성공하면_누적이_지워진다() throws Exception {
        register();
        failLogin(4);

        mockMvc.perform(json(post("/api/auth/login"), loginForm()))
                .andExpect(status().isOk());

        // 누적이 남아 있었다면 아래 한 번으로 다섯 번째가 되어 잠겼을 것이다
        failLogin(1);
        mockMvc.perform(json(post("/api/auth/login"), loginForm()))
                .andExpect(status().isOk());
    }

    // ── 보호 엔드포인트 ────────────────────────────────────────

    @Test
    @DisplayName("로그인 쿠키로 /me가 열린다")
    void me() throws Exception {
        register();
        Cookie access = loginAndGet(AuthCookies.ACCESS_TOKEN);

        mockMvc.perform(get("/api/auth/me").cookie(access))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.loginId").value(LOGIN_ID))
                .andExpect(jsonPath("$.data.name").value(NAME))
                .andExpect(jsonPath("$.data.phone").value(PHONE))
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
        register();

        mockMvc.perform(get("/api/auth/me")
                        .cookie(new Cookie(AuthCookies.ACCESS_TOKEN, "위조된.토큰.값")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    // ── 재발급 · 로그아웃 ──────────────────────────────────────

    @Test
    @DisplayName("리프레시 쿠키로 두 토큰이 새로 발급된다")
    void refresh() throws Exception {
        register();
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
        register();
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
        register();
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

    private Map<String, Object> verifyForm() {
        Map<String, Object> form = new HashMap<>();
        form.put("name", NAME);
        form.put("birthDate", BIRTH_DATE);
        form.put("phone", PHONE);
        return form;
    }

    /** 한 필드만 틀린 대조 요청 */
    private MockHttpServletRequestBuilder verifyWith(String field, String value) throws Exception {
        Map<String, Object> form = verifyForm();
        form.put(field, value);
        return json(post("/api/auth/verify-roster"), form);
    }

    private Map<String, Object> registerForm(String token) {
        Map<String, Object> form = new HashMap<>();
        form.put("registrationToken", token);
        form.put("loginId", LOGIN_ID);
        form.put("password", PASSWORD);
        return form;
    }

    private Map<String, Object> loginForm() {
        Map<String, Object> form = new HashMap<>();
        form.put("loginId", LOGIN_ID);
        form.put("password", PASSWORD);
        return form;
    }

    private String verifyAndGetToken() throws Exception {
        return tokenFrom(json(post("/api/auth/verify-roster"), verifyForm()));
    }

    /** 명단에 없는 다른 사람을 새로 넣고 그 사람의 증표를 받는다 */
    private String tokenFor(String name, String birthDate, String phone) throws Exception {
        rosterRepository.saveAndFlush(RosterEntry.builder()
                .name(name)
                .birthDate(LocalDate.parse(birthDate))
                .phoneNormalized(phone.replaceAll("\\D", ""))
                .phoneDisplay(phone)
                .active(true)
                .build());

        Map<String, Object> form = verifyForm();
        form.put("name", name);
        form.put("birthDate", birthDate);
        form.put("phone", phone);
        return tokenFrom(json(post("/api/auth/verify-roster"), form));
    }

    private String tokenFrom(MockHttpServletRequestBuilder request) throws Exception {
        String body = mockMvc.perform(request)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).path("data").path("registrationToken").asText();
    }

    /** 명단 확인 → 가입까지 한 번에 */
    private void register() throws Exception {
        mockMvc.perform(json(post("/api/auth/register"), registerForm(verifyAndGetToken())))
                .andExpect(status().isCreated());
    }

    private void failLogin(int times) throws Exception {
        Map<String, Object> wrong = loginForm();
        wrong.put("password", "틀린비밀번호1!");
        for (int i = 0; i < times; i++) {
            mockMvc.perform(json(post("/api/auth/login"), wrong))
                    .andExpect(status().isUnauthorized());
        }
    }

    private Cookie loginAndGet(String name) throws Exception {
        MvcResult result = mockMvc.perform(json(post("/api/auth/login"), loginForm()))
                .andExpect(status().isOk())
                .andReturn();
        Cookie cookie = result.getResponse().getCookie(name);
        assertThat(cookie).as("%s 쿠키가 없다", name).isNotNull();
        return cookie;
    }

    private String errorBodyOf(MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request)
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();
    }

    private MockHttpServletRequestBuilder json(
            MockHttpServletRequestBuilder builder, Map<String, Object> body) throws Exception {
        return builder.contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body));
    }
}
