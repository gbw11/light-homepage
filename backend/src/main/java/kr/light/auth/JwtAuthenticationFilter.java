package kr.light.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.Optional;

/**
 * 액세스 토큰 쿠키를 읽어 SecurityContext를 채운다.
 *
 * <p><b>이 필터는 요청을 거절하지 않는다.</b> 토큰이 없거나 틀렸으면 그냥
 * 익명으로 통과시키고, 막을지 말지는 뒤의 인가 규칙이 정한다. 여기서 401을
 * 던지면 공개 엔드포인트({@code GET /api/posts})까지 막힌다.
 *
 * <p>헤더({@code Authorization: Bearer})는 보지 않는다. 쿠키 방식으로 통일한 것이
 * XSS 방어의 전제이므로(ARCHITECTURE.md §6.3), 헤더도 받아주면 그 전제가 무너진다.
 */
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtProvider jwtProvider;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain) throws ServletException, IOException {

        readAccessToken(request)
                .flatMap(jwtProvider::parse)
                .ifPresent(principal -> authenticate(principal, request));

        chain.doFilter(request, response);
    }

    private void authenticate(AuthPrincipal principal, HttpServletRequest request) {
        var authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities());
        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    private Optional<String> readAccessToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return Optional.empty();
        }
        return Arrays.stream(cookies)
                .filter(cookie -> AuthCookies.ACCESS_TOKEN.equals(cookie.getName()))
                .map(Cookie::getValue)
                .findFirst();
    }
}
