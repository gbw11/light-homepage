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

/**
 * 가입·로그인·토큰 재발급·로그아웃 (SPEC_API.md §2).
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
    private final JwtProvider jwtProvider;
    private final PasswordEncoder passwordEncoder;

    /**
     * 이메일 가입 (SPEC_API.md §2.1).
     *
     * <p>가입 결과는 항상 {@code role=PENDING}이다. 승인 전까지 회원 API는 막힌다.
     */
    @Transactional
    public SignupResponse signUp(SignupRequest request) {
        if (!request.agreedToPrivacyPolicy()) {
            throw ApiException.validation("agreed", "개인정보 수집·이용에 동의해주세요.");
        }
        // 정규화하지 않으면 User@x.com과 user@x.com이 다른 계정이 된다.
        String email = normalizeEmail(request.email());

        if (memberRepository.existsByEmail(email)) {
            throw ApiException.duplicate("email", "이미 가입된 이메일입니다.");
        }

        Member member = memberRepository.save(Member.signUpWithEmail(
                request.name(),
                email,
                passwordEncoder.encode(request.password()),
                request.phone(),
                request.village()));

        return SignupResponse.of(member);
    }

    /**
     * 로그인 (SPEC_API.md §2.2).
     *
     * <p><b>⚠️ 승인 대기(PENDING)도 로그인은 성공한다.</b> 명세가 그렇게 정하고
     * 있다 — FE가 로그인 후 {@code role}을 보고 {@code /pending}으로 보낸다.
     * 여기서 막으면 미승인 회원이 자기 상태를 확인할 방법이 없어진다.
     *
     * <p><b>이메일이 없는 것과 비밀번호가 틀린 것을 구분해 응답하지 않는다.</b>
     * 구분하면 "이 이메일은 가입돼 있다"가 새어나가 계정 열거에 쓰인다.
     */
    @Transactional
    public Issued login(LoginRequest request, Instant now) {
        Member member = memberRepository.findByEmail(normalizeEmail(request.email()))
                .filter(m -> matchesPassword(request.password(), m))
                .orElseThrow(() -> {
                    log.debug("로그인 실패");   // 어느 이메일이었는지 로그에도 남기지 않는다
                    return ApiException.unauthorized();
                });

        return issueFor(member, now);
    }

    /**
     * 액세스 토큰 재발급 (SPEC_API.md §2.3).
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

    /** 로그아웃 (SPEC_API.md §2.4) — 이 브라우저의 리프레시 토큰만 폐기한다 */
    @Transactional
    public void logout(String rawRefreshToken, Instant now) {
        refreshTokenService.revoke(rawRefreshToken, now);
    }

    /** 내 정보 (SPEC_API.md §2.5) */
    @Transactional(readOnly = true)
    public MeResponse me(Long memberId) {
        return memberRepository.findById(memberId)
                .map(MeResponse::of)
                // 토큰은 유효한데 회원이 없다 = 탈퇴 후 토큰이 남은 경우
                .orElseThrow(ApiException::unauthorized);
    }

    private Issued issueFor(Member member, Instant now) {
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

    private String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase();
    }

    /** 발급 결과 — 회원과 두 토큰의 평문 */
    public record Issued(Member member, String accessToken, String refreshToken) {
    }
}
