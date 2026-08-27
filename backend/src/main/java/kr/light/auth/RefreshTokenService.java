package kr.light.auth;

import kr.light.member.Member;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

/**
 * 리프레시 토큰 발급·회전·폐기.
 *
 * <p><b>JWT를 쓰지 않는다.</b> JWT는 자체 검증되므로 서버가 "이미 버린 토큰"을
 * 거부할 수 없다. 로그아웃과 회전을 실제로 강제하려면 서버가 상태를 들고 있어야
 * 하고, 그래서 난수를 발급해 DB에 저장한다.
 *
 * <p><b>★ 평문을 저장하지 않는다.</b> DB가 유출되어도 토큰을 그대로 쓸 수 없어야
 * 한다 (V1__init.sql의 {@code refresh_tokens.token_hash} 주석).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private final RefreshTokenRepository repository;
    private final JwtProperties properties;

    private static final SecureRandom RANDOM = new SecureRandom();

    /** 256bit. 추측으로 뚫을 수 없어야 한다. */
    private static final int TOKEN_BYTES = 32;

    /**
     * 새 리프레시 토큰을 발급하고 <b>평문을 돌려준다.</b>
     *
     * <p>평문은 이 순간에만 존재한다 — 쿠키에 실어 보내고 나면 서버는 해시만
     * 갖는다. 다시 알아낼 방법이 없다.
     */
    @Transactional
    public String issue(Member member, Instant now) {
        byte[] bytes = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        repository.save(RefreshToken.builder()
                .member(member)
                .tokenHash(hash(raw))
                .expiresAt(now.plus(properties.refreshDuration()))
                .build());

        return raw;
    }

    /**
     * 회전 — 받은 토큰을 폐기하고 새로 발급한다 (ARCHITECTURE.md §6.3).
     *
     * <p>한 번 쓴 리프레시 토큰은 즉시 못 쓰게 된다. 토큰이 탈취돼도 공격자와
     * 정상 사용자 중 <b>먼저 쓴 쪽만</b> 통과하고, 나머지는 다음 시도에서 막힌다.
     *
     * @return 새 평문 토큰. 받은 토큰이 유효하지 않으면 {@code Optional.empty()}
     */
    @Transactional
    public Optional<Rotated> rotate(String rawToken, Instant now) {
        if (rawToken == null || rawToken.isBlank()) {
            return Optional.empty();
        }
        return repository.findByTokenHash(hash(rawToken))
                .filter(token -> token.isUsable(now))
                .map(token -> {
                    token.revoke(now);
                    Member member = token.getMember();
                    return new Rotated(member, issue(member, now));
                });
    }

    /**
     * 로그아웃 — 이 토큰만 폐기한다.
     *
     * <p>회원의 모든 토큰을 지우지 않는다. 다른 기기의 로그인까지 끊기면
     * "이 브라우저에서 로그아웃"이라는 기대와 어긋난다.
     *
     * <p>이미 없거나 만료된 토큰이어도 조용히 넘어간다 — 로그아웃은 실패할 이유가
     * 없는 동작이고, "그런 토큰 없다"는 응답은 토큰 존재 여부를 알려주는 셈이다.
     */
    @Transactional
    public void revoke(String rawToken, Instant now) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        repository.findByTokenHash(hash(rawToken))
                .filter(token -> !token.isRevoked())
                .ifPresent(token -> token.revoke(now));
    }

    /**
     * SHA-256.
     *
     * <p>비밀번호와 달리 BCrypt를 쓰지 않는다. BCrypt는 매번 다른 salt를 쓰기
     * 때문에 <b>해시로 조회할 수가 없다</b> — 전체 행을 훑으며 대조해야 한다.
     * 리프레시 토큰은 256bit 난수라 사전 공격 대상이 아니므로, 조회 가능한
     * 단방향 해시로 충분하다.
     */
    private String hash(String raw) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(raw.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(digest);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256은 모든 JVM이 지원한다. 여기 오면 환경이 깨진 것이다.
            throw new IllegalStateException("SHA-256을 쓸 수 없다", e);
        }
    }

    /** 회전 결과 — 누구의 토큰이었고, 새 평문이 무엇인지 */
    public record Rotated(Member member, String rawToken) {
    }
}
