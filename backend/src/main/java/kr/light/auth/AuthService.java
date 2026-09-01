package kr.light.auth;

import kr.light.common.ApiException;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

/**
 * 로그인·토큰 재발급·로그아웃 (SPEC_API.md §2.3~§2.6).
 *
 * <p>가입은 {@link RosterRegistrationService}가 맡는다 — 명단 대조가 얽혀
 * 있어 성격이 다르다.
 *
 * <p>토큰을 쿠키에 싣는 일은 여기서 하지 않는다 — 그것은 HTTP 계층의 몫이라
 * {@link AuthController}가 한다. 이 클래스는 <b>누구에게 어떤 토큰을 줄지</b>만
 * 판단한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final MemberRepository memberRepository;
    private final RefreshTokenService refreshTokenService;
    private final LoginAttemptService loginAttemptService;
    private final JwtProvider jwtProvider;
    private final PasswordEncoder passwordEncoder;

    /**
     * 로그인 (SPEC_API.md §2.3).
     *
     * <h2>실패는 전부 같은 401이다</h2>
     * 없는 아이디 · 틀린 비밀번호 · <b>잠긴 계정</b> — 셋을 구분해 응답하지
     * 않는다 (§9-G 확정). 구분하면 "이 아이디는 가입돼 있다"가 새어나가
     * 아이디 목록을 만드는 데 쓰인다.
     *
     * <p>승인 대기 분기는 사라졌다 — v1.3에서 {@code PENDING}이 없어졌고,
     * 계정이 있다는 것은 곧 명단에서 확인된 회원이라는 뜻이다.
     */
    @Transactional
    public Issued login(LoginRequest request, Instant now) {
        String loginId = request.loginId().trim();

        // ⚠️ 잠금 확인이 비밀번호 대조보다 앞이다. 뒤에 두면 잠긴 동안에도
        //    비밀번호를 계속 시험할 수 있어 잠금이 아무 일도 하지 않는다.
        if (loginAttemptService.isLocked(loginId, now)) {
            log.debug("잠긴 계정의 로그인 시도");   // 어느 아이디인지는 남기지 않는다
            throw ApiException.unauthorized();
        }

        Optional<Member> member = memberRepository.findByLoginId(loginId)
                .filter(m -> matchesPassword(request.password(), m));

        if (member.isEmpty()) {
            // ★ 별도 트랜잭션에 기록한다. 같은 트랜잭션이면 바로 아래 예외가
            //   방금 센 실패까지 되돌려 잠금이 영원히 동작하지 않는다
            //   (LoginAttemptService 주석 참고).
            loginAttemptService.recordFailure(loginId, now);
            log.debug("로그인 실패");
            throw ApiException.unauthorized();
        }

        loginAttemptService.reset(loginId);
        return issueFor(member.get(), now);
    }

    /**
     * 액세스 토큰 재발급 (SPEC_API.md §2.4).
     *
     * <p>리프레시 토큰은 <b>회전</b>한다 — 쓴 토큰은 즉시 폐기되고 새 토큰이 나간다.
     */
    @Transactional
    public Issued refresh(String rawRefreshToken, Instant now) {
        RefreshTokenService.Rotated rotated = refreshTokenService.rotate(rawRefreshToken, now)
                .orElseThrow(ApiException::unauthorized);

        // 회전 과정에서 이미 새 리프레시 토큰이 나왔다. 액세스만 새로 만든다.
        return new Issued(
                rotated.member(),
                jwtProvider.issueAccessToken(rotated.member(), now),
                rotated.rawToken());
    }

    /** 로그아웃 (SPEC_API.md §2.5) — 이 브라우저의 리프레시 토큰만 폐기한다 */
    @Transactional
    public void logout(String rawRefreshToken, Instant now) {
        refreshTokenService.revoke(rawRefreshToken, now);
    }

    /** 내 정보 (SPEC_API.md §2.6) */
    @Transactional(readOnly = true)
    public MeResponse me(Long memberId) {
        return memberRepository.findById(memberId)
                .map(MeResponse::of)
                // 토큰은 유효한데 회원이 없다 = 탈퇴 후 토큰이 남은 경우
                .orElseThrow(ApiException::unauthorized);
    }

    /**
     * 이 회원으로 세션을 연다 — 토큰 두 개를 발급한다.
     *
     * <p>카카오 콜백(§2.8)이 비밀번호 대조 없이 부른다. 그쪽은 카카오가
     * 본인 확인을 대신했으므로 이 시점에는 "누구인지"가 이미 정해져 있다.
     */
    @Transactional
    public Issued issueFor(Member member, Instant now) {
        return new Issued(
                member,
                jwtProvider.issueAccessToken(member, now),
                refreshTokenService.issue(member, now));
    }

    /**
     * 비밀번호 대조.
     *
     * <p>카카오 전용 계정은 {@code passwordHash}가 null이다. 그대로 인코더에
     * 넘기면 예외가 나므로 먼저 거른다 — 비밀번호 없는 계정에 비밀번호 로그인을
     * 허용하지 않는다는 뜻이기도 하다.
     */
    private boolean matchesPassword(String rawPassword, Member member) {
        return member.getPasswordHash() != null
                && passwordEncoder.matches(rawPassword, member.getPasswordHash());
    }

    /** 발급 결과 — 회원과 두 토큰의 평문 */
    public record Issued(Member member, String accessToken, String refreshToken) {
    }
}
