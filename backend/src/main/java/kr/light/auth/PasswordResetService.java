package kr.light.auth;

import kr.light.common.ApiException;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

/**
 * 비밀번호 재설정 (SPEC_API.md §2.9·§2.10 · NFR-SEC-08).
 *
 * <p>인증 없이 <b>남의 계정 비밀번호를 바꾸는 길</b>이라, 이 프로젝트에서 가장
 * 조심해야 하는 흐름 중 하나다. 아래 네 가지가 그 이유다.
 *
 * <ol>
 *   <li><b>계정 존재를 알려주지 않는다.</b> 요청은 결과와 무관하게 항상 성공한다</li>
 *   <li><b>토큰은 1회용이고 만료된다.</b> 쓰는 즉시 닫히고 30분 뒤 죽는다</li>
 *   <li><b>재설정하면 기존 로그인이 전부 끊긴다.</b> 아래 참고</li>
 *   <li><b>평문 토큰을 저장하지 않는다.</b> 리프레시 토큰과 같은 이유다</li>
 * </ol>
 */
@Slf4j
@Service
public class PasswordResetService {

    private final MemberRepository memberRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final PasswordResetNotifier notifier;
    private final Duration ttl;

    private static final SecureRandom RANDOM = new SecureRandom();

    /** 256bit. 메일로 오가는 값이라 추측으로 뚫려서는 안 된다. */
    private static final int TOKEN_BYTES = 32;

    public PasswordResetService(MemberRepository memberRepository,
                                PasswordResetTokenRepository tokenRepository,
                                RefreshTokenRepository refreshTokenRepository,
                                PasswordEncoder passwordEncoder,
                                PasswordResetNotifier notifier,
                                @org.springframework.beans.factory.annotation.Value(
                                        "${app.auth.password-reset-ttl:1800}") long ttlSeconds) {
        this.memberRepository = memberRepository;
        this.tokenRepository = tokenRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.notifier = notifier;
        this.ttl = Duration.ofSeconds(ttlSeconds);
    }

    // ── 요청 (§2.9) ───────────────────────────────────────────

    /**
     * 재설정 메일 발송.
     *
     * <p><b>⚠️ 이 메서드는 아무것도 알려주지 않는다.</b> 가입되지 않은 이메일이든,
     * 카카오 전용 계정이든, 정상 계정이든 <b>겉보기 결과가 같다</b>. 호출자는
     * 언제나 204를 받는다 (SPEC_API.md §2.9).
     *
     * <p>구분해서 응답하면 "이 이메일이 이 사이트에 가입돼 있다"가 새어나가고,
     * 그것만으로 계정 열거가 된다.
     */
    @Transactional
    public void requestReset(String email, Instant now) {
        memberRepository.findByEmail(normalize(email))
                .filter(this::canResetPassword)
                .ifPresentOrElse(
                        member -> issueToken(member, now),
                        () -> log.debug("재설정 요청 — 대상 없음. 응답은 성공과 같다."));
    }

    /**
     * 비밀번호 로그인을 쓰는 계정인가.
     *
     * <p>카카오 전용 계정은 {@code passwordHash}가 null이다. 재설정해봐야 쓸
     * 로그인 수단이 없고, 오히려 비밀번호 로그인을 열어주는 셈이 된다.
     */
    private boolean canResetPassword(Member member) {
        return member.getPasswordHash() != null;
    }

    private void issueToken(Member member, Instant now) {
        // 이전에 보낸 링크는 여기서 닫는다. 살아 있는 링크는 항상 하나뿐이어야 한다.
        tokenRepository.invalidateAllFor(member, now);

        String raw = randomToken();
        tokenRepository.save(PasswordResetToken.builder()
                .member(member)
                .tokenHash(hash(raw))
                .expiresAt(now.plus(ttl))
                .build());

        notifyQuietly(member, raw);
    }

    // ── 확정 (§2.10) ──────────────────────────────────────────

    /**
     * 새 비밀번호 설정.
     *
     * <p><b>★ 성공하면 그 회원의 리프레시 토큰을 전부 폐기한다.</b> 명세에는
     * 없지만, 비밀번호를 재설정하는 상황은 대개 <b>계정이 남의 손에 있을지도
     * 모른다</b>는 뜻이다. 기존 세션을 살려두면 공격자의 로그인이 그대로
     * 유지되어, 비밀번호를 바꾼 의미가 사라진다.
     *
     * <p>토큰이 없거나·이미 썼거나·만료됐으면 <b>전부 같은 401</b>이다. 구분하면
     * 어떤 토큰이 존재하는지가 새어나간다.
     */
    @Transactional
    public void confirmReset(String rawToken, String newPassword, Instant now) {
        PasswordResetToken token = tokenRepository.findByTokenHash(hash(rawToken))
                .filter(t -> t.isUsable(now))
                .orElseThrow(() -> {
                    log.debug("재설정 실패 — 없거나 이미 썼거나 만료된 토큰");
                    return ApiException.unauthorized();
                });

        Member member = token.getMember();
        setPassword(member, passwordEncoder.encode(newPassword));
        token.markUsed(now);

        int revoked = refreshTokenRepository.revokeAllFor(member, now);
        log.info("비밀번호 재설정 완료. members.id={}, 폐기한 리프레시 토큰={}개",
                member.getId(), revoked);
    }

    /**
     * 비밀번호 교체.
     *
     * <p>{@code Member}에 setter를 두지 않았다 — 엔티티를 아무 데서나 고칠 수
     * 있게 되면 도메인 규칙이 흩어진다. 비밀번호 변경은 재설정(여기)과
     * 변경(§2.12, 미구현) 두 곳뿐이라, 그 두 곳이 생길 때 엔티티에 정식
     * 메서드를 두는 편이 낫다. <b>§2.12를 만들 때 함께 정리할 것.</b>
     */
    private void setPassword(Member member, String encodedPassword) {
        try {
            var field = Member.class.getDeclaredField("passwordHash");
            field.setAccessible(true);
            field.set(member, encodedPassword);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException("비밀번호 설정 실패", e);
        }
    }

    // ── 보조 ──────────────────────────────────────────────────

    /** 알림이 실패해도 토큰 발급은 유지한다 — 사용자는 다시 요청하면 된다 */
    private void notifyQuietly(Member member, String rawToken) {
        try {
            notifier.notifyResetRequested(member, rawToken, ttl);
        } catch (RuntimeException e) {
            log.error("재설정 메일 발송 실패. members.id={}", member.getId(), e);
        }
    }

    private String randomToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /**
     * SHA-256. 평문을 저장하지 않는다.
     *
     * <p>BCrypt를 쓰지 않는 이유는 리프레시 토큰과 같다 — salt가 매번 달라
     * 해시로 조회할 수 없다. 256bit 난수는 사전 공격 대상이 아니다.
     */
    private String hash(String raw) {
        if (raw == null) {
            return "";
        }
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(raw.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256을 쓸 수 없다", e);
        }
    }

    private String normalize(String email) {
        return email == null ? null : email.trim().toLowerCase();
    }
}
