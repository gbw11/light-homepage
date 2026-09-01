package kr.light.common;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * 조회 가능한 단방향 해시로 다루는 토큰 — 리프레시·비밀번호 재설정·가입.
 *
 * <p>셋 다 같은 성질이다: <b>평문은 발급 순간에만 존재하고</b>, 서버는 해시만
 * 갖는다. 평문이 DB에 있으면 그것을 읽을 수 있는 사람이 남의 세션을 쓰거나,
 * 남의 비밀번호를 바꾸거나, 남의 이름으로 계정을 만들 수 있다.
 *
 * <h2>왜 BCrypt가 아닌가</h2>
 * BCrypt는 매번 다른 salt를 쓰기 때문에 <b>해시로 조회할 수가 없다</b> — 전체
 * 행을 훑으며 대조해야 한다. 이 토큰들은 256bit 난수라 사전 공격 대상이
 * 아니므로 조회 가능한 단방향 해시로 충분하다. (비밀번호는 사람이 만든 값이라
 * 반대다 — 그쪽은 반드시 BCrypt다.)
 */
public final class SecureTokens {

    private static final SecureRandom RANDOM = new SecureRandom();

    /** 256bit. 추측할 수 없어야 하는 값의 하한선이다 */
    private static final int TOKEN_BYTES = 32;

    private SecureTokens() {
    }

    /** URL·쿠키에 그대로 실을 수 있는 난수 토큰 평문 */
    public static String randomToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** SHA-256 — 저장·조회에 쓰는 값 */
    public static String hash(String raw) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(raw.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(digest);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256은 모든 JVM이 지원한다. 여기 오면 환경이 깨진 것이다.
            throw new IllegalStateException("SHA-256을 쓸 수 없다", e);
        }
    }
}
