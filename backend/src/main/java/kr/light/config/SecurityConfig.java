package kr.light.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import kr.light.auth.JwtAuthenticationFilter;
import kr.light.common.ErrorCode;
import kr.light.common.ErrorResponse;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.access.hierarchicalroles.RoleHierarchy;
import org.springframework.security.access.hierarchicalroles.RoleHierarchyImpl;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.access.expression.method.DefaultMethodSecurityExpressionHandler;
import org.springframework.security.access.expression.method.MethodSecurityExpressionHandler;

import java.nio.charset.StandardCharsets;

/**
 * Security 설정.
 *
 * <p>하는 일은 네 가지다.
 * <ol>
 *   <li>공개 경로를 연다 — 열지 않으면 Boot 기본 정책이 전부 막는다</li>
 *   <li>{@code JwtAuthenticationFilter}로 쿠키의 액세스 토큰을 읽어 인증을 세운다</li>
 *   <li>역할 계층({@link #roleHierarchy()})을 걸어 {@code @PreAuthorize} 하나로
 *       상위 역할까지 통과하게 한다</li>
 *   <li>필터 체인에서 나가는 401·403을 계약된 봉투로 만든다 (SPEC_API.md §1.1)</li>
 * </ol>
 *
 * <p><b>CSRF를 끈 이유:</b> 세션을 쓰지 않는 stateless API다. 쿠키 방식 JWT의
 * CSRF 방어는 {@code SameSite=Lax}(→ {@code AuthCookies})와 Origin 헤더 검증으로
 * 한다 (ARCHITECTURE.md §6.3). <b>Origin 검증은 아직 없다</b> — 남은 M2 항목이다.
 *
 * <h2>보호 엔드포인트를 만들 때 (ARCHITECTURE.md §5.2 — 2층 방어)</h2>
 *
 * <p>여기 {@code PUBLIC_*_PATHS}에 넣지 않으면 로그인은 강제된다. 하지만
 * <b>"로그인했다"와 "권한이 있다"는 다르다.</b> 역할이 필요한 엔드포인트에는
 * 컨트롤러 메서드에 {@code @PreAuthorize}를 직접 단다.
 *
 * <pre>
 * &#64;PreAuthorize("isAuthenticated()")   // 로그인만 — PENDING도 통과
 * &#64;PreAuthorize("hasRole('MEMBER')")   // 승인된 회원 이상 (PENDING 차단)
 * &#64;PreAuthorize("hasRole('LEADER')")   // 임원 이상 — 계층상 PASTOR도 통과
 * &#64;PreAuthorize("hasRole('PASTOR')")   // 전도사만
 * </pre>
 *
 * <p><b>⚠️ 그리고 서비스 계층에서 한 번 더 검사한다.</b> {@code @PreAuthorize}는
 * "이 역할이면 이 엔드포인트를 부를 수 있다"까지만 본다. "이 사람이 <b>이
 * 리소스</b>를 볼 수 있는가"는 컨트롤러가 알 수 없다 — 그건
 * {@code PostQueryService} 같은 단일 관문의 몫이다. 한 층만으로는 부족하다.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
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

    /**
     * 조회가 아닌데도 열어두는 경로 (POST 한정).
     *
     * <p>새가족 등록은 비로그인 포함 누구나 부를 수 있는 유일한 쓰기
     * 엔드포인트다 (인가 매트릭스 {@code POST /newcomers} 전 역할 통과).
     * 스팸 방어는 필터가 아니라 {@code NewcomerService}가 honeypot·동의 검증·
     * rate limit으로 한다.
     */
    private static final String[] PUBLIC_POST_PATHS = {
            "/api/newcomers",
            // 인증을 얻기 위한 경로는 인증 없이 열려야 한다 (SPEC_API.md §2.1~§2.4).
            // ⚠️ /api/auth/** 로 뭉뚱그리지 않는다. 그러면 나중에 추가될
            //    PATCH /api/auth/me(권한 M)·DELETE /api/auth/me까지 함께 열린다.
            // 가입 2단계 — 아직 계정이 없는 사람이 부른다
            "/api/auth/verify-roster",
            "/api/auth/register",
            "/api/auth/login",
            "/api/auth/refresh",
            "/api/auth/logout",
            // 비밀번호를 잊은 사람은 로그인할 수 없다 — 인증을 요구하면 모순이다
            "/api/auth/password/reset-with-code"
    };

    private final ObjectMapper objectMapper;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;

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
                        .requestMatchers(HttpMethod.POST, PUBLIC_POST_PATHS).permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(authenticationEntryPoint())
                        .accessDeniedHandler(accessDeniedHandler()))
                // 인가 판단(AuthorizationFilter) 전에 SecurityContext가 채워져 있어야 한다.
                // UsernamePasswordAuthenticationFilter 자리에 끼우는 것이 관례다.
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    /**
     * 역할 계층 — 상위가 하위를 포함한다 (ARCHITECTURE.md §5.1).
     *
     * <p>이걸 걸어야 {@code hasRole('LEADER')} 하나로 PASTOR까지 통과한다. 없으면
     * 엔드포인트마다 상위 역할을 일일이 나열해야 하고, 빠뜨리면 전도사가 임원
     * 기능을 못 쓴다.
     *
     * <p><b>⚠️ PENDING은 계층에 넣지 않는다.</b> 넣으면 미승인 회원이 MEMBER
     * 권한을 물려받는다. PENDING은 "아직 아무것도 아님"이지 최하위 회원이 아니다.
     */
    @Bean
    public RoleHierarchy roleHierarchy() {
        return RoleHierarchyImpl.withDefaultRolePrefix()
                .role("PASTOR").implies("LEADER")
                .role("LEADER").implies("MEMBER")
                .build();
    }

    /** 메서드 보안(@PreAuthorize)에서도 위 계층이 적용되게 한다 */
    @Bean
    public MethodSecurityExpressionHandler methodSecurityExpressionHandler(RoleHierarchy roleHierarchy) {
        DefaultMethodSecurityExpressionHandler handler = new DefaultMethodSecurityExpressionHandler();
        handler.setRoleHierarchy(roleHierarchy);
        return handler;
    }

    /**
     * BCrypt (BACKEND_TASKS.md §4 — {@code members.password_hash}).
     *
     * <p>salt가 해시 문자열에 포함되므로 별도 컬럼이 필요 없다. 강도는 기본값(10)을
     * 쓴다 — Render 무료 인스턴스가 512MB·저사양이라 올리면 로그인이 눈에 띄게
     * 느려진다.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
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
     * <p>⚠️ <b>같은 "권한 부족"이 두 경로로 나간다</b> — 경로 규칙에서 걸리면
     * 여기(필터 체인), {@code @PreAuthorize}에서 걸리면
     * {@link kr.light.common.GlobalExceptionHandler}다. 두 곳이 서로 다른 코드를
     * 내보내면 FE는 같은 상황에서 다른 화면을 띄운다 — 실제로 어긋난 적이 있다.
     * <b>한쪽을 바꾸면 반드시 다른 쪽도 본다.</b>
     *
     * <p>v1.3에서 {@code PENDING}이 사라져 지금은 양쪽 다 {@code FORBIDDEN}
     * 하나뿐이다. 역할별로 갈릴 일이 다시 생기면 그때 판단을 한곳으로 모은다.
     *
     * <p>⚠️ 여기까지 왔다는 것은 "리소스는 있는데 권한이 없다"를 알려주는
     * 것이다. 존재를 숨겨야 하는 리소스(예산안 등)는 필터가 아니라 서비스
     * 계층에서 404로 만들어야 한다 (ARCHITECTURE.md §5.2).
     */
    @Bean
    public AccessDeniedHandler accessDeniedHandler() {
        return (request, response, deniedException) -> writeError(response, ErrorCode.FORBIDDEN);
    }

    private void writeError(HttpServletResponse response, ErrorCode code) throws java.io.IOException {
        response.setStatus(code.status().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(response.getWriter(), ErrorResponse.of(code));
    }
}
