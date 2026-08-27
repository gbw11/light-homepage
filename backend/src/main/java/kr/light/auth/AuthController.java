package kr.light.auth;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import kr.light.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/**
 * 인증 (SPEC_API.md §2).
 *
 * <p><b>토큰은 응답 본문에 넣지 않는다.</b> 전부 httpOnly 쿠키로 나간다 —
 * 본문에 실으면 JS가 읽을 수 있게 되어 XSS 방어가 사라진다 (ARCHITECTURE.md §6.3).
 *
 * <p>가입·로그인·재발급·로그아웃까지가 이번 범위다. 카카오 로그인(§2.6·§2.7),
 * 비밀번호 재설정(§2.9·§2.10), 프로필 수정(§2.11~§2.13)은 M2의 다음 항목이다.
 */
@Tag(name = "인증", description = "가입 · 로그인 · 토큰 재발급 · 로그아웃")
@RestController
@RequestMapping(value = "/api/auth", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final JwtProperties jwtProperties;

    /**
     * 쿠키에 {@code Secure}를 붙일지.
     *
     * <p>⚠️ 로컬은 http라 Secure 쿠키가 브라우저에 저장조차 되지 않는다 — 켜두면
     * 개발 중 로그인이 통째로 안 된다. 운영(https)에서는 반드시 켜야 하므로
     * prod 프로필에서 true로 준다.
     */
    @Value("${app.auth.secure-cookie:false}")
    private boolean secureCookie;

    @Operation(summary = "이메일 회원가입",
            description = """
                    가입 즉시 회원이 되지 않습니다. `role=PENDING`으로 대기하고 전도사가 승인해야
                    회원 API가 열립니다.

                    `agreed`가 `true`가 아니면 `VALIDATION_ERROR`입니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "201", description = "가입 완료 — 승인 대기"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400", ref = "#/components/responses/VALIDATION_ERROR"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "409", ref = "#/components/responses/DUPLICATE")
    })
    @PostMapping("/signup")
    public ResponseEntity<ApiResponse<SignupResponse>> signUp(@Valid @RequestBody SignupRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.of(authService.signUp(request)));
    }

    @Operation(summary = "로그인",
            description = """
                    성공하면 `access_token`·`refresh_token` 쿠키가 설정됩니다. 응답 본문에
                    토큰은 없습니다 — httpOnly라 JS가 읽을 수 없습니다.

                    ⚠️ **승인 대기(`PENDING`)도 로그인은 성공합니다.** 응답의 `role`을 보고
                    `/pending`으로 보내 주세요. 회원 API는 서버가 따로 막습니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200", description = "로그인 성공 — 쿠키 설정됨"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400", ref = "#/components/responses/VALIDATION_ERROR"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED")
    })
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest request) {
        AuthService.Issued issued = authService.login(request, Instant.now());
        return withAuthCookies(issued)
                .body(ApiResponse.of(LoginResponse.of(issued.member())));
    }

    @Operation(summary = "액세스 토큰 재발급",
            description = """
                    `refresh_token` 쿠키가 필요합니다. 성공하면 두 쿠키가 모두 새로 설정됩니다.

                    ⚠️ **리프레시 토큰은 회전합니다.** 한 번 쓴 토큰은 즉시 폐기되므로,
                    같은 토큰으로 두 번 호출하면 두 번째는 `UNAUTHORIZED`입니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200", description = "재발급 성공 — 쿠키 갱신됨"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED")
    })
    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> refresh(
            @CookieValue(name = AuthCookies.REFRESH_TOKEN, required = false) String refreshToken
    ) {
        AuthService.Issued issued = authService.refresh(refreshToken, Instant.now());
        return withAuthCookies(issued)
                .body(ApiResponse.of(Map.of("refreshed", true)));
    }

    @Operation(summary = "로그아웃",
            description = """
                    리프레시 토큰을 DB에서 폐기하고 두 쿠키를 지웁니다.

                    이 브라우저만 로그아웃됩니다 — 다른 기기의 로그인은 유지됩니다.
                    """)
    @ApiResponses(@io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "204", description = "로그아웃 완료"))
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @CookieValue(name = AuthCookies.REFRESH_TOKEN, required = false) String refreshToken
    ) {
        authService.logout(refreshToken, Instant.now());
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, AuthCookies.expireAccess(secureCookie).toString())
                .header(HttpHeaders.SET_COOKIE, AuthCookies.expireRefresh(secureCookie).toString())
                .build();
    }

    @Operation(summary = "내 정보",
            description = "로그인이 필요합니다. 승인 대기(`PENDING`) 상태에서도 조회됩니다.")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200", description = "조회 성공"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED")
    })
    // ⚠️ hasRole('MEMBER')가 아니라 isAuthenticated()다. 승인 대기(PENDING) 회원도
    //    자기 정보는 볼 수 있어야 한다 — 못 보면 자기가 어떤 상태인지 확인할
    //    방법이 없다 (SPEC_API.md §2.5 "권한 로그인").
    @PreAuthorize("isAuthenticated()")
    @GetMapping("/me")
    public ApiResponse<MeResponse> me(@AuthenticationPrincipal AuthPrincipal principal) {
        return ApiResponse.of(authService.me(principal.memberId()));
    }

    /**
     * 두 토큰 쿠키를 함께 싣는다.
     *
     * <p>쿠키의 만료는 토큰 자체의 TTL과 같은 값을 쓴다 — 쿠키가 더 오래 살면
     * 브라우저는 이미 죽은 토큰을 계속 보내고, 더 짧으면 멀쩡한 토큰을 잃는다.
     */
    private ResponseEntity.BodyBuilder withAuthCookies(AuthService.Issued issued) {
        ResponseCookie access = AuthCookies.access(
                issued.accessToken(), jwtProperties.accessDuration(), secureCookie);
        ResponseCookie refresh = AuthCookies.refresh(
                issued.refreshToken(), jwtProperties.refreshDuration(), secureCookie);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, access.toString())
                .header(HttpHeaders.SET_COOKIE, refresh.toString());
    }
}
