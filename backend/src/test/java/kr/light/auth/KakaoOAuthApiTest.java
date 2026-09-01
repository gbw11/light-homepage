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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 카카오 로그인 (SPEC_API.md §2.7 · §2.8).
 *
 * <p><b>카카오 서버는 부르지 않는다.</b> 네트워크가 필요하고 매번 사람이
 * 로그인해야 해서 CI에서 불가능하다. 그리고 정작 확인해야 하는 것은 카카오가
 * 아니라 <b>우리 쪽 분기</b>다 — 기존 가입자인가, 증표가 유효한가, state가
 * 우리가 발급한 것인가, 명단이 아직 열려 있는가.
 *
 * <p>그래서 {@link KakaoClient}를 가로채고 그 분기들을 전부 태운다.
 *
 * <p>⚠️ 이름에 {@code Authorization}을 넣지 않았다. 인가 매트릭스가 아니다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class KakaoOAuthApiTest {

    @Autowired MockMvc mockMvc;
    @Autowired MemberRepository memberRepository;
    @Autowired RosterEntryRepository rosterRepository;
    @Autowired RegistrationTokenRepository registrationTokenRepository;
    @Autowired OAuthStateRepository stateRepository;
    @Autowired RefreshTokenRepository refreshTokenRepository;
    @Autowired VerifyRosterRateLimiter rateLimiter;
    @Autowired ObjectMapper objectMapper;

    /** 카카오 서버 역할 */
    @MockitoBean KakaoClient kakaoClient;

    private static final String KAKAO_ID = "1234567890";
    private static final String NAME = "김도연a";
    private static final String BIRTH_DATE = "2001-03-14";
    private static final String PHONE = "010-1234-5678";

    @BeforeEach
    void setUp() {
        refreshTokenRepository.deleteAllInBatch();
        stateRepository.deleteAllInBatch();
        registrationTokenRepository.deleteAllInBatch();
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

        when(kakaoClient.exchangeCodeForAccessToken(anyString())).thenReturn("kakao-access-token");
        when(kakaoClient.fetchUserId(anyString())).thenReturn(KAKAO_ID);
    }

    // ── 인가 URL (§2.7) ───────────────────────────────────────

    @Nested
    @DisplayName("카카오로 보내기")
    class Authorize {

        @Test
        @DisplayName("로그인 없이 카카오 인가 URL로 302된다")
        void 인가_URL로_보낸다() throws Exception {
            String location = authorizeLocation(null);

            assertThat(location)
                    .startsWith("https://kauth.kakao.com/oauth/authorize")
                    .contains("response_type=code")
                    .contains("state=");
        }

        @Test
        @DisplayName("★ registrationToken이 state에 실려 나가지 않는다")
        void 증표가_URL에_노출되지_않는다() throws Exception {
            String token = verifyAndGetToken();

            String location = URLDecoder.decode(authorizeLocation(token), StandardCharsets.UTF_8);

            // state는 주소창·리퍼러·브라우저 기록에 남는다. 증표는 그것만 있으면
            // 남의 이름으로 계정을 만들 수 있는 값이라 실어 보내면 안 된다.
            assertThat(location).doesNotContain(token);
        }

        @Test
        @DisplayName("state는 매번 달라진다 — 재사용하면 CSRF 방어가 사라진다")
        void state는_매번_다르다() throws Exception {
            assertThat(stateOf(authorizeLocation(null)))
                    .isNotEqualTo(stateOf(authorizeLocation(null)));
        }

        @Test
        @DisplayName("증표가 만료·위조면 카카오로 보내기 전에 막는다")
        void 잘못된_증표는_미리_막는다() throws Exception {
            // 여기서 안 막으면 사용자가 카카오 화면까지 갔다가 돌아와서야 실패를 안다
            mockMvc.perform(get("/api/auth/kakao/authorize").param("registrationToken", "없는토큰"))
                    .andExpect(status().isUnauthorized());
        }
    }

    // ── 콜백 (§2.8) ───────────────────────────────────────────

    @Nested
    @DisplayName("카카오가 돌려보냄")
    class Callback {

        @Test
        @DisplayName("★ 신규 + 유효한 증표 → 계정이 생기고 /my로 간다")
        void 신규_가입() throws Exception {
            String state = stateOf(authorizeLocation(verifyAndGetToken()));

            mockMvc.perform(get("/api/auth/kakao/callback")
                            .param("code", "kakao-code").param("state", state))
                    .andExpect(status().isFound())
                    .andExpect(redirectedUrl("http://localhost:3000/my"))
                    .andExpect(cookie().exists(AuthCookies.ACCESS_TOKEN))
                    .andExpect(cookie().exists(AuthCookies.REFRESH_TOKEN));

            Member created = memberRepository.findByKakaoId(KAKAO_ID).orElseThrow();
            assertThat(created.getRole()).isEqualTo(Role.MEMBER);
            // 이름·연락처는 카카오가 아니라 명단에서 온다
            assertThat(created.getName()).isEqualTo(NAME);
            assertThat(created.getPhone()).isEqualTo(PHONE);
            // 카카오 가입자는 아이디·비밀번호가 없다
            assertThat(created.getLoginId()).isNull();
            assertThat(created.hasPasswordLogin()).isFalse();
        }

        @Test
        @DisplayName("기존 카카오 계정 → 로그인만 하고 /my로 간다")
        void 기존_계정_로그인() throws Exception {
            String state = stateOf(authorizeLocation(verifyAndGetToken()));
            mockMvc.perform(get("/api/auth/kakao/callback")
                    .param("code", "c").param("state", state));
            assertThat(memberRepository.count()).isEqualTo(1);

            // 두 번째 로그인 — 증표 없이
            String loginState = stateOf(authorizeLocation(null));
            mockMvc.perform(get("/api/auth/kakao/callback")
                            .param("code", "c2").param("state", loginState))
                    .andExpect(status().isFound())
                    .andExpect(redirectedUrl("http://localhost:3000/my"))
                    .andExpect(cookie().exists(AuthCookies.ACCESS_TOKEN));

            assertThat(memberRepository.count()).isEqualTo(1);   // 늘지 않았다
        }

        @Test
        @DisplayName("★ 증표 없는 신규는 가입되지 않는다 — 카카오만으로는 가입할 수 없다")
        void 증표_없는_신규는_되돌린다() throws Exception {
            String state = stateOf(authorizeLocation(null));

            // 카카오는 이름·생년월일·전화번호를 주지 않는다. 명단 대조를
            // 건너뛴 계정이 생기면 "계정 = 명단에서 확인된 사람"이 무너진다.
            mockMvc.perform(get("/api/auth/kakao/callback")
                            .param("code", "c").param("state", state))
                    .andExpect(status().isFound())
                    .andExpect(redirectedUrl("http://localhost:3000/signup?error=kakao"))
                    .andExpect(cookie().doesNotExist(AuthCookies.ACCESS_TOKEN));

            assertThat(memberRepository.count()).isZero();
        }

        @Test
        @DisplayName("★ 우리가 발급하지 않은 state는 거부한다 — 이것이 CSRF 방어다")
        void 모르는_state는_거부한다() throws Exception {
            // 없으면 남이 만든 콜백 URL로 피해자의 브라우저에 공격자의
            // 카카오 계정을 붙일 수 있다
            mockMvc.perform(get("/api/auth/kakao/callback")
                            .param("code", "c").param("state", "내가만든state"))
                    .andExpect(status().isFound())
                    .andExpect(redirectedUrl("http://localhost:3000/signup?error=kakao"));

            assertThat(memberRepository.count()).isZero();
        }

        @Test
        @DisplayName("★ state는 1회용이다")
        void state는_1회용() throws Exception {
            String state = stateOf(authorizeLocation(verifyAndGetToken()));
            mockMvc.perform(get("/api/auth/kakao/callback")
                    .param("code", "c").param("state", state));

            when(kakaoClient.fetchUserId(anyString())).thenReturn("9999999999");
            mockMvc.perform(get("/api/auth/kakao/callback")
                            .param("code", "c").param("state", state))
                    .andExpect(redirectedUrl("http://localhost:3000/signup?error=kakao"));

            assertThat(memberRepository.findByKakaoId("9999999999")).isEmpty();
        }

        @Test
        @DisplayName("카카오가 실패해도 JSON이 아니라 리다이렉트로 답한다")
        void 카카오_실패도_리다이렉트() throws Exception {
            String state = stateOf(authorizeLocation(verifyAndGetToken()));
            when(kakaoClient.exchangeCodeForAccessToken(anyString()))
                    .thenThrow(new KakaoException("코드가 만료됐습니다"));

            // 브라우저에 에러 봉투가 찍히면 사용자는 무엇을 해야 할지 모른다
            MvcResult result = mockMvc.perform(get("/api/auth/kakao/callback")
                            .param("code", "c").param("state", state))
                    .andExpect(status().isFound())
                    .andExpect(redirectedUrl("http://localhost:3000/signup?error=kakao"))
                    .andReturn();

            assertThat(result.getResponse().getContentAsString()).isEmpty();
        }

        @Test
        @DisplayName("사용자가 동의를 취소하면(code 없음) 가입 화면으로 되돌린다")
        void 동의_취소() throws Exception {
            mockMvc.perform(get("/api/auth/kakao/callback").param("error", "access_denied"))
                    .andExpect(status().isFound())
                    .andExpect(redirectedUrl("http://localhost:3000/signup?error=kakao"));
        }

        @Test
        @DisplayName("★ 대조와 콜백 사이에 명단이 선점되면 계정을 만들지 않는다")
        void 선점된_명단() throws Exception {
            String state = stateOf(authorizeLocation(verifyAndGetToken()));

            // 그 사이 아이디·비밀번호로 먼저 가입해 버렸다
            RosterEntry entry = rosterRepository.findAll().get(0);
            Member first = memberRepository.saveAndFlush(
                    Member.registerFromRoster(entry, "faster01", "hash"));
            entry.claimBy(first, Instant.now());
            rosterRepository.saveAndFlush(entry);

            mockMvc.perform(get("/api/auth/kakao/callback")
                            .param("code", "c").param("state", state))
                    .andExpect(redirectedUrl("http://localhost:3000/signup?error=kakao"));

            assertThat(memberRepository.findByKakaoId(KAKAO_ID)).isEmpty();
        }
    }

    // ── 보조 ──────────────────────────────────────────────────

    private String authorizeLocation(String registrationToken) throws Exception {
        var request = get("/api/auth/kakao/authorize");
        if (registrationToken != null) {
            request = request.param("registrationToken", registrationToken);
        }
        return mockMvc.perform(request)
                .andExpect(status().isFound())
                .andExpect(header().exists("Location"))
                .andReturn().getResponse().getHeader("Location");
    }

    private String stateOf(String location) {
        String marker = "state=";
        String state = location.substring(location.indexOf(marker) + marker.length());
        int end = state.indexOf('&');
        return URLDecoder.decode(end < 0 ? state : state.substring(0, end), StandardCharsets.UTF_8);
    }

    private String verifyAndGetToken() throws Exception {
        String body = mockMvc.perform(post("/api/auth/verify-roster")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", NAME, "birthDate", BIRTH_DATE, "phone", PHONE))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).path("data").path("registrationToken").asText();
    }
}
