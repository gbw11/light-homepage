package kr.light.auth;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import kr.light.member.Member;
import kr.light.member.Role;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 액세스 토큰 발급·검증 (BACKEND_TASKS.md §10 M2 — DoD: 유효/만료/위조 각각 테스트).
 *
 * <p>토큰 검증이 뚫리면 인가 매트릭스 전체가 무의미해진다. 여기가 인증의
 * 바닥이다.
 */
class JwtProviderTest {

    private static final String SECRET = "test-secret-key-at-least-256-bits-long-for-hmac-sha256!!";  // allowlist-secret

    private final JwtProperties properties = new JwtProperties(SECRET, 1800, 1209600);
    private final JwtProvider provider = new JwtProvider(properties);

    /**
     * ⚠️ 고정 시각을 쓰지 않는다.
     *
     * <p>{@code JwtProvider.parse}는 검증에 <b>시스템 시계</b>를 쓴다(jjwt 내부).
     * 발급 시각만 과거로 고정해두면, 실제 시계가 그 시각 + TTL을 지나는 순간
     * 멀쩡한 테스트가 만료로 깨진다 — 실제로 그렇게 깨졌다. 발급도 "지금"으로
     * 맞춰야 두 시계가 어긋나지 않는다.
     */
    private final Instant now = Instant.now();

    // ── 유효 ──────────────────────────────────────────────────

    @Test
    @DisplayName("발급한 토큰에서 회원 id와 역할이 그대로 나온다")
    void 유효한_토큰() {
        String token = provider.issueAccessToken(member(42L, Role.LEADER), now);

        AuthPrincipal principal = provider.parse(token).orElseThrow();

        assertThat(principal.memberId()).isEqualTo(42L);
        assertThat(principal.role()).isEqualTo(Role.LEADER);
    }

    @Test
    @DisplayName("역할은 ROLE_ 접두사가 붙은 권한이 된다 — hasRole이 이걸 찾는다")
    void 권한_접두사() {
        String token = provider.issueAccessToken(member(1L, Role.PASTOR), now);

        AuthPrincipal principal = provider.parse(token).orElseThrow();

        assertThat(principal.authorities())
                .extracting("authority")
                .containsExactly("ROLE_PASTOR");
    }

    // ── 만료 ──────────────────────────────────────────────────

    @Test
    @DisplayName("TTL이 지난 토큰은 거부한다")
    void 만료된_토큰() {
        // 30분 + 10초 전에 발급된 토큰
        assertThat(parseTokenIssued(properties.accessTtl() + 10)).isEmpty();
    }

    @Test
    @DisplayName("만료 직전까지는 통과한다")
    void 만료_경계() {
        // 29분 50초 전에 발급 — 아직 살아 있어야 한다
        assertThat(parseTokenIssued(properties.accessTtl() - 10)).isPresent();
    }

    // ── 위조 ──────────────────────────────────────────────────

    @Test
    @DisplayName("다른 키로 서명한 토큰은 거부한다 — 위조")
    void 위조된_서명() {
        var attackerKey = Keys.hmacShaKeyFor(
                "attacker-key-that-is-also-long-enough-for-hmac-sha256!!".getBytes(StandardCharsets.UTF_8));

        String forged = Jwts.builder()
                .subject("42")
                .claim("role", Role.PASTOR.name())     // 전도사로 승격 시도
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(1, ChronoUnit.HOURS)))
                .signWith(attackerKey)
                .compact();

        assertThat(provider.parse(forged)).isEmpty();
    }

    @Test
    @DisplayName("본문을 고친 토큰은 거부한다 — 서명이 깨진다")
    void 변조된_본문() {
        String token = provider.issueAccessToken(member(42L, Role.MEMBER), now);

        // payload 한 글자만 바꿔도 서명과 어긋난다
        String[] parts = token.split("\\.");
        String tamperedPayload = parts[1].substring(0, parts[1].length() - 2)
                + (parts[1].endsWith("A") ? "B" : "A");
        String tampered = parts[0] + "." + tamperedPayload + "." + parts[2];

        assertThat(provider.parse(tampered)).isEmpty();
    }

    @Test
    @DisplayName("서명이 아예 없는 토큰(alg=none 류)은 거부한다")
    void 서명_없는_토큰() {
        String unsigned = Jwts.builder()
                .subject("42")
                .claim("role", Role.PASTOR.name())
                .compact();

        assertThat(provider.parse(unsigned)).isEmpty();
    }

    // ── 형식 오류 ──────────────────────────────────────────────

    @Test
    @DisplayName("빈 값·쓰레기 문자열은 조용히 거부한다 — 예외를 던지지 않는다")
    void 형식_오류() {
        // 필터가 매 요청 호출한다. 여기서 예외가 나가면 요청 전체가 500이 된다.
        assertThat(provider.parse(null)).isEmpty();
        assertThat(provider.parse("")).isEmpty();
        assertThat(provider.parse("   ")).isEmpty();
        assertThat(provider.parse("not-a-jwt")).isEmpty();
        assertThat(provider.parse("a.b.c")).isEmpty();
    }

    // ── 설정 ──────────────────────────────────────────────────

    @Test
    @DisplayName("짧은 secret은 기동 시점에 거부한다 — 첫 로그인까지 미루지 않는다")
    void 짧은_시크릿() {
        assertThatThrownBy(() -> new JwtProperties("too-short", 1800, 1209600))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("32바이트");

        assertThatThrownBy(() -> new JwtProperties(null, 1800, 1209600))
                .isInstanceOf(IllegalStateException.class);
    }

    // ── 보조 ──────────────────────────────────────────────────

    /**
     * {@code secondsAgo}초 전에 발급된 토큰을 만들어 지금 파싱한다.
     *
     * <p>{@code parse}는 시각을 인자로 받지 않는다 — jjwt가 내부적으로 시스템
     * 시계를 본다. 그래서 "미래에 파싱"하는 대신 <b>발급 시각을 과거로 미는</b>
     * 방식으로 만료를 재현한다.
     */
    private java.util.Optional<AuthPrincipal> parseTokenIssued(long secondsAgo) {
        String token = provider.issueAccessToken(
                member(42L, Role.MEMBER), Instant.now().minusSeconds(secondsAgo));
        return provider.parse(token);
    }

    private Member member(Long id, Role role) {
        Member m = Member.builder()
                .name("테스트")
                .loginId("t%d".formatted(id))
                .role(role)
                .build();
        // id는 DB가 채우는 값이라 빌더로 못 넣는다. 테스트에서만 리플렉션으로 심는다.
        try {
            var field = Member.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(m, id);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
        return m;
    }
}
