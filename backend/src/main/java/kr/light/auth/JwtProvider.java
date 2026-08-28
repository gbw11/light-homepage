package kr.light.auth;

import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import kr.light.member.Member;
import kr.light.member.Role;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;

/**
 * 액세스 토큰 발급·검증.
 *
 * <p><b>액세스 토큰만 JWT다.</b> 리프레시 토큰은 JWT가 아니라 임의의 난수이며
 * DB에 해시로 저장한다({@link RefreshTokenService}) — 폐기(logout)와 회전을
 * 서버가 통제해야 하는데, 자체 검증되는 JWT로는 "이미 버린 토큰"을 막을 수 없다.
 *
 * <p>담는 정보는 <b>식별자와 역할뿐</b>이다. 이름·이메일은 넣지 않는다 —
 * JWT는 서명될 뿐 암호화되지 않아 누구나 내용을 읽을 수 있고, 쿠키가 어딘가
 * 로그에 찍히면 그대로 개인정보 유출이 된다.
 *
 * <p>역할을 토큰에 담으므로 <b>권한 변경이 즉시 반영되지 않는다</b> — 강등된
 * 회원이 최대 30분(액세스 TTL) 동안 이전 권한으로 통과한다. 요청마다 DB를
 * 읽지 않기 위한 의도적 맞바꿈이고, 즉시 끊어야 하면 리프레시 토큰을 폐기해
 * 30분 뒤 로그아웃되게 한다.
 */
@Slf4j
@Component
public class JwtProvider {

    /** 역할 클레임 이름. FE가 읽는 값이 아니라 서버 내부 규약이다. */
    private static final String CLAIM_ROLE = "role";

    private final SecretKey key;
    private final JwtProperties properties;

    public JwtProvider(JwtProperties properties) {
        this.properties = properties;
        this.key = Keys.hmacShaKeyFor(properties.secret().getBytes(StandardCharsets.UTF_8));
    }

    /** 액세스 토큰 발급. {@code sub}는 회원 id, {@code role}은 역할 이름. */
    public String issueAccessToken(Member member, Instant now) {
        Instant expiry = now.plus(properties.accessDuration());
        return Jwts.builder()
                .subject(String.valueOf(member.getId()))
                .claim(CLAIM_ROLE, member.getRole().name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .signWith(key)
                .compact();
    }

    /**
     * 토큰을 검증하고 주체를 꺼낸다.
     *
     * <p><b>실패는 전부 {@code Optional.empty()}</b>다 — 만료·위조·형식 오류를
     * 구분해 응답하지 않는다. "서명이 틀렸다"와 "만료됐다"를 구분해 알려주면
     * 공격자에게 힌트가 된다. 서버 로그로만 구분한다.
     */
    public Optional<AuthPrincipal> parse(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        try {
            var claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            Long memberId = Long.valueOf(claims.getSubject());
            Role role = Role.valueOf(claims.get(CLAIM_ROLE, String.class));
            return Optional.of(new AuthPrincipal(memberId, role));

        } catch (ExpiredJwtException e) {
            // 흔한 일이다. 30분마다 모든 사용자에게 일어난다 — 경고로 올리지 않는다.
            log.debug("만료된 액세스 토큰");
            return Optional.empty();
        } catch (JwtException | IllegalArgumentException e) {
            // 위조·변조·알 수 없는 역할 값. 이건 정상 흐름이 아니다.
            log.warn("유효하지 않은 액세스 토큰: {}", e.getClass().getSimpleName());
            return Optional.empty();
        }
    }
}
