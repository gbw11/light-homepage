package kr.light.auth;

import kr.light.common.ApiException;
import kr.light.common.SecureTokens;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import kr.light.roster.RosterEntry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

/**
 * 카카오 로그인 (SPEC_API.md §2.7 · §2.8).
 *
 * <h2>⚠️ 카카오만으로는 가입할 수 없다</h2>
 * 카카오는 이름·생년월일·전화번호를 주지 않는다. 그래서 <b>명단 대조를
 * 건너뛸 수 없다</b> — 카카오는 가입 2단계의 "수단 ②"일 뿐이고, 가입을
 * 간소화해 주지 않는다 (§9-F). FE 문구가 "3초 만에 시작"이면 안 되는 이유다.
 *
 * <h2>카카오가 남기는 것</h2>
 * 카카오로 가입하면 아이디·비밀번호가 없다. <b>카카오 계정을 잃으면 로그인
 * 수단이 사라지고</b>, 전도사가 계정을 지워야 다시 가입할 수 있다 (§8.2).
 * 대신 비밀번호를 잊었을 때 스스로 들어올 수 있는 유일한 길이기도 하다 —
 * 이메일을 받지 않아 자력 재설정이 없기 때문이다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class KakaoOAuthService {

    private static final String AUTHORIZE_URL = "https://kauth.kakao.com/oauth/authorize";

    /** state 수명. 로그인 화면을 거쳐 돌아오는 데 걸리는 시간이다 */
    private static final Duration STATE_TTL = Duration.ofMinutes(5);

    private final KakaoClient kakaoClient;
    private final KakaoProperties properties;
    private final OAuthStateRepository stateRepository;
    private final RegistrationTokenRepository registrationTokenRepository;
    private final MemberRepository memberRepository;

    // ── 1단계: 카카오로 보낸다 (§2.7) ───────────────────────────────

    /**
     * 카카오 인가 URL을 만든다.
     *
     * @param rawRegistrationToken 가입 경로면 1단계 증표, 로그인이면 {@code null}
     */
    @Transactional
    public String authorizeUrl(String rawRegistrationToken, Instant now) {
        if (!properties.isConfigured()) {
            // 키를 넣지 않은 채 카카오 버튼을 누른 경우다. 500으로 터지면
            // 원인을 짐작할 수 없으니 무엇이 빠졌는지 말해 준다.
            log.error("app.kakao.rest-api-key가 비어 있습니다 — 카카오 로그인을 쓸 수 없습니다");
            throw ApiException.validation("kakao", "카카오 로그인이 설정되지 않았습니다.");
        }

        RegistrationToken registration = resolveRegistrationToken(rawRegistrationToken, now);

        String rawState = SecureTokens.randomToken();
        stateRepository.save(OAuthState.builder()
                .stateHash(SecureTokens.hash(rawState))
                .registrationToken(registration)
                .expiresAt(now.plus(STATE_TTL))
                .build());

        return UriComponentsBuilder.fromUriString(AUTHORIZE_URL)
                .queryParam("client_id", properties.restApiKey())
                .queryParam("redirect_uri", properties.redirectUri())
                .queryParam("response_type", "code")
                .queryParam("state", rawState)
                .build()
                .toUriString();
    }

    // ── 2단계: 카카오가 돌려보낸다 (§2.8) ───────────────────────────

    /**
     * 콜백 처리.
     *
     * <p>실패해도 예외를 밖으로 내지 않는다 — 콜백은 <b>리다이렉트로 답해야</b>
     * 하고, 브라우저에 JSON 에러가 찍히면 사용자는 무엇을 해야 할지 알 수 없다.
     * 모든 실패는 "명단 확인부터 다시"로 모인다.
     */
    @Transactional
    public Outcome handleCallback(String code, String rawState, Instant now) {
        if (code == null || code.isBlank() || rawState == null || rawState.isBlank()) {
            // 사용자가 카카오 동의 화면에서 취소한 경우도 여기로 온다
            log.debug("카카오 콜백에 code 또는 state가 없습니다");
            return Outcome.failed();
        }

        Optional<OAuthState> found = stateRepository.findByStateHash(SecureTokens.hash(rawState))
                .filter(s -> s.isUsable(now));
        if (found.isEmpty()) {
            // 우리가 발급하지 않은 state · 이미 쓴 state · 만료된 state.
            // ★ 이 검사가 CSRF 방어다 — 없으면 남이 만든 콜백 URL로
            //   피해자의 브라우저에 공격자의 카카오 계정을 붙일 수 있다.
            log.debug("알 수 없거나 만료된 state");
            return Outcome.failed();
        }
        OAuthState state = found.get();
        state.markUsed(now);

        String kakaoId;
        try {
            kakaoId = kakaoClient.fetchUserId(kakaoClient.exchangeCodeForAccessToken(code));
        } catch (KakaoException e) {
            log.warn("카카오 인증 실패: {}", e.getMessage());
            return Outcome.failed();
        }

        // ① 이미 카카오로 가입한 사람 — 로그인
        Optional<Member> existing = memberRepository.findByKakaoId(kakaoId);
        if (existing.isPresent()) {
            return Outcome.loggedIn(existing.get());
        }

        // ② 처음 온 사람 — 명단 대조를 통과했어야 계정을 만들 수 있다
        RegistrationToken registration = state.getRegistrationToken();
        if (registration == null || !registration.isUsable(now)) {
            // 명단 확인 없이 카카오 버튼부터 누른 경우다. 카카오는 이름·생년월일·
            // 전화번호를 주지 않으므로 여기서 계정을 만들 방법이 없다.
            log.debug("증표 없는 신규 카카오 사용자 — 명단 확인으로 되돌린다");
            return Outcome.failed();
        }

        RosterEntry entry = registration.getRosterEntry();
        if (!entry.isClaimable()) {
            // 대조와 콜백 사이에 누군가 먼저 가져갔다
            log.debug("이미 계정이 만들어진 명단 행");
            return Outcome.failed();
        }

        Member member = memberRepository.save(Member.registerFromRosterWithKakao(entry, kakaoId));
        entry.claimBy(member, now);
        registration.markUsed(now);

        log.info("카카오로 가입: member={}", member.getId());
        return Outcome.loggedIn(member);
    }

    // ── 내부 ─────────────────────────────────────────────────────────

    /**
     * 가입 경로의 증표를 확인한다.
     *
     * <p>여기서 미리 걸러 두면 사용자가 <b>카카오 화면까지 갔다가</b> 돌아와서야
     * 실패를 아는 일을 막을 수 있다.
     */
    private RegistrationToken resolveRegistrationToken(String rawToken, Instant now) {
        if (rawToken == null || rawToken.isBlank()) {
            return null;    // 기존 카카오 가입자의 로그인
        }
        return registrationTokenRepository.findByTokenHash(SecureTokens.hash(rawToken))
                .filter(t -> t.isUsable(now))
                .orElseThrow(ApiException::unauthorized);
    }

    /**
     * 콜백의 결과.
     *
     * @param member 성공했으면 그 회원. 실패면 {@code null}
     */
    public record Outcome(Member member) {

        public static Outcome loggedIn(Member member) {
            return new Outcome(member);
        }

        public static Outcome failed() {
            return new Outcome(null);
        }

        public boolean isSuccess() {
            return member != null;
        }
    }
}
