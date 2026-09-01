package kr.light.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * JWT 설정 — {@code app.jwt.*} (application.yml).
 *
 * <p>TTL은 초 단위로 받는다. 액세스 30분 / 리프레시 14일이 기본이다
 * (ARCHITECTURE.md §6.3).
 *
 * @param secret    HMAC-SHA256 서명 키. <b>최소 256bit</b>. 환경변수로만 주입한다
 * @param accessTtl 액세스 토큰 수명(초)
 * @param refreshTtl 리프레시 토큰 수명(초)
 */
@ConfigurationProperties(prefix = "app.jwt")
public record JwtProperties(String secret, long accessTtl, long refreshTtl) {

    /**
     * HMAC-SHA256은 키가 256bit(32바이트) 이상이어야 한다. jjwt가 짧은 키를
     * 거부하는데, 그 실패가 <b>첫 로그인 요청에서야</b> 드러나면 원인을 찾기
     * 어렵다. 기동 시점에 터뜨린다.
     */
    public JwtProperties {
        if (secret == null || secret.getBytes(java.nio.charset.StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException(
                    "app.jwt.secret이 없거나 너무 짧다. HMAC-SHA256은 최소 32바이트가 필요하다.");
        }
    }

    public Duration accessDuration() {
        return Duration.ofSeconds(accessTtl);
    }

    public Duration refreshDuration() {
        return Duration.ofSeconds(refreshTtl);
    }
}
