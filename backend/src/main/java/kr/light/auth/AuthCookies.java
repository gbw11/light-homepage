package kr.light.auth;

import org.springframework.boot.web.server.Cookie;
import org.springframework.http.ResponseCookie;

import java.time.Duration;

/**
 * 인증 쿠키의 이름과 형태를 한곳에서 정한다 (ARCHITECTURE.md §6.3).
 *
 * <p><b>httpOnly</b>라 JS가 읽지 못한다 — XSS가 나도 토큰을 훔칠 수 없다.
 * localStorage에 JWT를 넣는 방식은 구현이 쉽지만 XSS 한 번에 전부 털린다.
 *
 * <p><b>SameSite=Lax</b>가 CSRF 1차 방어다. FE가 Next.js rewrites로 동일 출처를
 * 만들기 때문에 Lax로 충분하고, None을 쓸 이유가 없다.
 *
 * <p>⚠️ <b>{@code secure}는 운영에서만 켠다.</b> 로컬은 http라 secure 쿠키가
 * 아예 저장되지 않아 로그인이 안 된다.
 */
public final class AuthCookies {

    public static final String ACCESS_TOKEN = "access_token";
    public static final String REFRESH_TOKEN = "refresh_token";

    /**
     * 리프레시 쿠키의 경로.
     *
     * <p>액세스 쿠키({@code /})와 달리 인증 경로에만 실어 보낸다. 매 요청에 딸려
     * 다니면 노출 면적만 넓어진다.
     *
     * <p><b>⚠️ {@code /api/auth/refresh}로 더 좁히면 로그아웃이 깨진다.</b>
     * 브라우저는 경로가 맞는 쿠키만 보내므로, {@code /api/auth/logout} 요청에는
     * 리프레시 쿠키가 실리지 않는다. 그러면 서버가 폐기할 토큰을 받지 못해
     * <b>로그아웃해도 리프레시 토큰이 계속 살아 있다.</b>
     *
     * <p>MockMvc는 경로를 무시하고 쿠키를 싣기 때문에 테스트로는 드러나지 않는다.
     * 실제 브라우저·curl에서만 나타난다 — 좁히고 싶어지면 이 주석을 먼저 읽을 것.
     */
    public static final String REFRESH_PATH = "/api/auth";

    private AuthCookies() {
    }

    public static ResponseCookie access(String token, Duration maxAge, boolean secure) {
        return build(ACCESS_TOKEN, token, maxAge, "/", secure);
    }

    public static ResponseCookie refresh(String token, Duration maxAge, boolean secure) {
        return build(REFRESH_TOKEN, token, maxAge, REFRESH_PATH, secure);
    }

    /** 로그아웃 — 같은 이름·경로로 maxAge 0을 덮어써야 브라우저가 지운다 */
    public static ResponseCookie expireAccess(boolean secure) {
        return build(ACCESS_TOKEN, "", Duration.ZERO, "/", secure);
    }

    public static ResponseCookie expireRefresh(boolean secure) {
        return build(REFRESH_TOKEN, "", Duration.ZERO, REFRESH_PATH, secure);
    }

    private static ResponseCookie build(String name, String value, Duration maxAge,
                                        String path, boolean secure) {
        return ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(secure)
                .sameSite(Cookie.SameSite.LAX.attributeValue())
                .path(path)
                .maxAge(maxAge)
                .build();
    }
}
