package kr.light.auth;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import kr.light.common.ApiResponse;
import kr.light.common.ClientAddress;
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
 * 인증 (SPEC_API.md §2 v1.3).
 *
 * <p><b>토큰은 응답 본문에 넣지 않는다.</b> 전부 httpOnly 쿠키로 나간다 —
 * 본문에 실으면 JS가 읽을 수 있게 되어 XSS 방어가 사라진다 (ARCHITECTURE.md §6.3).
 *
 * <p>가입은 <b>명단 확인 → 계정 생성</b> 2단계다. 승인 절차는 없다 —
 * 명단 대조가 본인 확인을 대신한다 (§9-B 확정).
 *
 * <p>카카오 로그인(§2.7·§2.8), 리셋 코드(§2.9), 프로필(§2.10~§2.12)은
 * 아직이다.
 */
@Tag(name = "인증", description = "명단 확인 · 가입 · 로그인 · 토큰 재발급 · 로그아웃")
@RestController
@RequestMapping(value = "/api/auth", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final RosterRegistrationService registrationService;
    private final PasswordResetService passwordResetService;
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

    @Operation(summary = "명단 확인 (가입 1단계)",
            description = """
                    교회 명단과 이름·생년월일·전화번호를 대조합니다. 통과하면 **1회용 ·
                    5분** 토큰을 돌려주고, 그 토큰으로 2단계에서 계정을 만듭니다.

                    ⚠️ **어느 필드가 틀렸는지 알려주지 않습니다.** 불일치·명단에 없음·
                    이미 계정 있음·시도 초과가 **전부 같은 401**입니다 — 구분해 주면
                    값을 바꿔가며 교인 명단을 캐낼 수 있습니다.

                    이름은 **동명이인 접미사를 포함**해서 보냅니다 (`김도연a`).
                    전화번호 표기는 자유입니다 — 서버가 숫자만 남겨 비교합니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200", description = "확인됨 — 5분 안에 2단계로"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400", ref = "#/components/responses/VALIDATION_ERROR"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED")
    })
    @PostMapping("/verify-roster")
    public ApiResponse<VerifyRosterResponse> verifyRoster(
            @Valid @RequestBody VerifyRosterRequest request,
            HttpServletRequest servletRequest
    ) {
        return ApiResponse.of(registrationService.verify(
                request, ClientAddress.of(servletRequest), Instant.now()));
    }

    @Operation(summary = "계정 생성 (가입 2단계)",
            description = """
                    1단계에서 받은 토큰으로 계정을 만듭니다. **승인 없이 즉시
                    `MEMBER`**입니다.

                    이름·전화번호는 보내지 않습니다 — 1단계에서 대조한 명단 행에서
                    가져옵니다.

                    ⚠️ **세션 쿠키가 함께 나가지 않습니다.** 가입 완료 화면에서
                    로그인으로 유도해 주세요 (2026-09-01 확정).

                    비밀번호가 **생년월일·전화번호와 같으면 거부**합니다 — 방금 그
                    두 값을 입력했기에 가장 손이 가지만, 이 서비스에서 그 둘은
                    본인임을 증명하는 값입니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "201", description = "가입 완료 — 즉시 회원"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400", ref = "#/components/responses/VALIDATION_ERROR"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "409", ref = "#/components/responses/DUPLICATE")
    })
    @PostMapping("/register")
    public ResponseEntity<ApiResponse<RegisterResponse>> register(
            @Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.of(registrationService.register(request, Instant.now())));
    }

    @Operation(summary = "로그인",
            description = """
                    가입 때 정한 **아이디**로 로그인합니다 (이메일이 아닙니다).
                    성공하면 `access_token`·`refresh_token` 쿠키가 설정됩니다.

                    ⚠️ **5회 실패하면 15분간 잠깁니다.** 잠긴 동안에도 응답은
                    일반 실패와 **같은 401**입니다 — "잠겼습니다"는 곧 "이 아이디는
                    존재합니다"라서 알려줄 수 없습니다.
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

    @Operation(summary = "리셋 코드로 비밀번호 재설정",
            description = """
                    전도사에게 받은 **1회용 · 30분** 코드로 비밀번호를 바꿉니다.

                    이메일을 수집하지 않으므로 자력 재설정 수단이 없습니다. 전도사가
                    명단의 전화번호로 본인을 확인한 뒤 코드를 구두·문자로 전달합니다
                    (§8.4). 카카오 가입자는 카카오 로그인으로 들어올 수 있습니다.

                    코드는 **대소문자·하이픈을 가리지 않습니다** — 입으로 전달받아
                    옮겨 적는 값이라 표기가 흔들리는 것이 정상입니다.

                    ⚠️ **성공하면 그 회원의 모든 기기에서 로그아웃됩니다.** 재설정하는
                    상황은 대개 계정이 남의 손에 있을지도 모른다는 뜻입니다.

                    없는 아이디·틀린 코드·만료된 코드·이미 쓴 코드는 **전부 같은 401**입니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "204", description = "변경 완료 — 모든 기기 로그아웃됨"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400", ref = "#/components/responses/VALIDATION_ERROR"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED")
    })
    @PostMapping("/password/reset-with-code")
    public ResponseEntity<Void> resetWithCode(@Valid @RequestBody ResetWithCodeRequest request) {
        passwordResetService.resetWithCode(
                request.loginId(), request.resetCode(), request.password(), Instant.now());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "내 정보", description = "로그인이 필요합니다.")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200", description = "조회 성공"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED")
    })
    // hasRole('MEMBER')가 아니라 isAuthenticated()다. 역할이 무엇이든 자기
    // 정보는 볼 수 있어야 한다 (SPEC_API.md §2.6 "권한 로그인").
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
