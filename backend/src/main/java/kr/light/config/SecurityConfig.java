package kr.light.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import kr.light.common.ErrorCode;
import kr.light.common.ErrorResponse;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;

import java.nio.charset.StandardCharsets;

/**
 * Security 설정 — <b>M1 최소판</b>.
 *
 * <p>목적은 두 가지뿐이다.
 * <ol>
 *   <li>Swagger UI를 열어 FE가 계약서를 볼 수 있게 한다. 설정이 없으면 Boot
 *       기본 정책이 모든 경로를 막아 {@code /swagger-ui.html}이 401이 된다.</li>
 *   <li>필터 체인에서 나가는 401·403도 계약된 봉투 형태로 만든다
 *       (SPEC_API.md §1.1).</li>
 * </ol>
 *
 * <p><b>⚠️ 아직 인증이 없다.</b> JWT 발급·검증 필터, 쿠키 처리, 역할 기반
 * 인가 규칙은 전부 M2다 (BACKEND_TASKS.md §10 M2 — "Spring Security 설정 +
 * JWT"). 지금은 <b>열어둔 경로 외에는 전부 막혀 있다</b> — 인증 수단이 없으므로
 * 사실상 아무도 통과하지 못한다. 공개 엔드포인트({@code POST /api/newcomers} 등)는
 * 그것을 만드는 시점에 아래 목록에 추가한다.
 *
 * <p><b>CSRF를 끈 이유:</b> 세션을 쓰지 않는 stateless API다. 쿠키 방식 JWT의
 * CSRF 방어는 {@code SameSite=Lax} + Origin 헤더 검증으로 하기로 되어 있고
 * (ARCHITECTURE.md §6.3), 그 구현도 M2다.
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    /**
     * 인증 없이 <b>필터를 통과시키는</b> 경로. 늘어날 때마다 인가 매트릭스에 행을
     * 추가한다 (ARCHITECTURE.md §5.3).
     *
     */
    private static final String[] PUBLIC_PATHS = {
            // 계약서 — FE가 봐야 하므로 열어둔다. 운영에서는 springdoc 자체가 꺼진다.
            "/swagger-ui.html",
            "/swagger-ui/**",
            "/v3/api-docs",
            "/v3/api-docs/**",
            // Render 슬립 방지 핑이 때린다
            "/actuator/health",
            "/actuator/health/**"
    };

    /**
     * 조회만 열어두는 경로 (GET 한정).
     *
     * <p>{@code POST /api/posts}(작성, LEADER)까지 함께 열리면 안 되므로 메서드를
     * 나눠서 건다.
     *
     * <p>⚠️ <b>"필터를 통과한다"가 "누구나 볼 수 있다"는 뜻은 아니다.</b>
     * {@code /api/posts}는 공개 공지와 예산안이 같은 경로를 쓴다. 실제 열람 권한은
     * {@code PostQueryService}의 단일 관문이 category로 판단해 401·403·404를
     * 던진다. 필터에서 막아버리면 공개 공지까지 함께 막힌다.
     */
    private static final String[] PUBLIC_GET_PATHS = {
            "/api/posts",
            "/api/posts/**"
    };

    private final ObjectMapper objectMapper;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())
                // 동일 출처 프록시라 CORS 설정이 필요 없다 (ARCHITECTURE.md §6.3)
                .cors(cors -> cors.disable())
                // 브라우저 기본 로그인 창·로그인 폼을 띄우지 않는다. 띄우면 FE의
                // 공통 에러 파서가 JSON 대신 HTML을 받는다.
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable())
                .logout(logout -> logout.disable())
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(PUBLIC_PATHS).permitAll()
                        .requestMatchers(HttpMethod.GET, PUBLIC_GET_PATHS).permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(authenticationEntryPoint())
                        .accessDeniedHandler(accessDeniedHandler()))
                .build();
    }

    /**
     * 미인증 → 401.
     *
     * <p>{@code GlobalExceptionHandler}는 {@code @RestControllerAdvice}라
     * 필터 체인에서 던져진 예외에 도달하지 못한다. 그래서 같은 봉투를 여기서
     * 한 번 더 만든다.
     */
    @Bean
    public AuthenticationEntryPoint authenticationEntryPoint() {
        return (request, response, authException) ->
                writeError(response, ErrorCode.UNAUTHORIZED);
    }

    /**
     * 역할 부족 → 403.
     *
     * <p>⚠️ 여기까지 왔다는 것은 "리소스는 있는데 권한이 없다"를 알려주는
     * 것이다. 존재를 숨겨야 하는 리소스(예산안 등)는 필터가 아니라 서비스
     * 계층에서 404로 만들어야 한다 (ARCHITECTURE.md §5.2).
     */
    @Bean
    public AccessDeniedHandler accessDeniedHandler() {
        return (request, response, deniedException) ->
                writeError(response, ErrorCode.FORBIDDEN);
    }

    private void writeError(HttpServletResponse response, ErrorCode code) throws java.io.IOException {
        response.setStatus(code.status().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(response.getWriter(), ErrorResponse.of(code));
    }
}
