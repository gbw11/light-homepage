package kr.light.auth;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import kr.light.common.ApiResponse;
import kr.light.common.ClientAddress;
import kr.light.member.Member;
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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
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
 * <p>프로필 수정·비밀번호 변경·탈퇴(§2.10~§2.12)까지 여기 있다.
 */
@Tag(name = "인증", description = "명단 확인 · 가입 · 로그인 · 토큰 재발급 · 로그아웃")
@RestController
@RequestMapping(value = "/api/auth", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final RosterRegistrationService registrationService;
    private final PasswordResetService passwordResetService;
    private final KakaoOAuthService kakaoOAuthService;
    private final ProfileService profileService;
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

    /**
     * 카카오 콜백이 돌려보낼 FE 주소.
     *
     * <p>⚠️ <b>요청에서 받지 않고 설정에서만 읽는다.</b> 리다이렉트 주소를
     * 사용자가 정하게 두면 열린 리다이렉트가 되어, 우리 도메인을 거쳐
     * 아무 데나 보내는 링크를 만들 수 있다.
     */
    @Value("${app.auth.frontend-base-url:http://localhost:3000}")
    private String frontendBaseUrl;

    /** 성공 시 이동할 FE 경로 (§2.8) */
    private static final String KAKAO_SUCCESS_PATH = "/my";

    /** 실패 시 이동할 FE 경로 — 명단 확인부터 다시 (§2.8) */
    private static final String KAKAO_FAILURE_PATH = "/signup?error=kakao";

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

    @Operation(summary = "카카오 인가 URL로 보냄",
            description = """
                    카카오 로그인 화면으로 **302 리다이렉트**합니다.

                    두 용도로 씁니다:
                    - **기존 카카오 가입자의 로그인** — 파라미터 없이 호출
                    - **가입 2단계의 수단 ②** — `registrationToken`을 함께 보냅니다

                    ⚠️ **카카오만으로는 가입할 수 없습니다.** 카카오는 이름·생년월일·
                    전화번호를 주지 않으므로 §2.1 명단 확인을 건너뛸 수 없습니다.
                    FE 문구는 "본인 확인 후 카카오로 계속"입니다 — "3초 만에 시작"이
                    아닙니다.

                    `state`는 서버가 만듭니다. **`registrationToken`을 `state`에 직접
                    싣지 않습니다** — `state`는 인가 URL에 노출되는데 그 토큰만 있으면
                    남의 이름으로 계정을 만들 수 있기 때문입니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "302", description = "카카오 인가 URL로 이동"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400", ref = "#/components/responses/VALIDATION_ERROR"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED")
    })
    @GetMapping("/kakao/authorize")
    public ResponseEntity<Void> kakaoAuthorize(
            @RequestParam(required = false) String registrationToken) {
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(kakaoOAuthService.authorizeUrl(registrationToken, Instant.now())))
                .build();
    }

    @Operation(summary = "카카오 콜백",
            description = """
                    카카오가 브라우저를 되돌려 보내는 곳입니다. **항상 302**로
                    FE 화면에 돌려보냅니다 — 실패해도 JSON 에러를 내지 않습니다.
                    브라우저에 에러 봉투가 찍히면 사용자는 무엇을 해야 할지
                    알 수 없기 때문입니다.

                    | 상황 | 이동 |
                    |---|---|
                    | 기존 카카오 계정 | `/my` (쿠키 설정됨) |
                    | 신규 + 유효한 `registrationToken` | 계정 생성 후 `/my` |
                    | 신규 + 토큰 없음·만료, 그 밖의 모든 실패 | `/signup?error=kakao` |
                    """)
    @ApiResponses(@io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "302", description = "FE로 이동 (성공이면 쿠키 설정됨)"))
    @GetMapping("/kakao/callback")
    public ResponseEntity<Void> kakaoCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state
    ) {
        KakaoOAuthService.Outcome outcome =
                kakaoOAuthService.handleCallback(code, state, Instant.now());

        if (!outcome.isSuccess()) {
            return redirect(frontendBaseUrl + KAKAO_FAILURE_PATH).build();
        }

        AuthService.Issued issued = authService.issueFor(outcome.member(), Instant.now());
        return withAuthCookies(redirect(frontendBaseUrl + KAKAO_SUCCESS_PATH), issued).build();
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

    @Operation(summary = "프로필 수정",
            description = """
                    연락처를 바꿉니다.

                    ⚠️ **이름은 바꿀 수 없습니다** — 명단에서 온 값이고, 계정의 이름이
                    명단과 갈라지면 "계정 = 명단에서 확인된 사람"이라는 전제가
                    무너집니다. 명단의 이름이 틀렸다면 교회 명단을 고칠 일입니다.

                    ⚠️ **명단의 전화번호는 바뀌지 않습니다.** 여기서 바꾸는 것은
                    이 서비스의 연락처입니다. 명단 대조(§2.1)의 기준이 사용자가
                    고칠 수 있는 값이 되면 대조가 본인 확인 구실을 못 합니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200", description = "수정된 프로필"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400", ref = "#/components/responses/VALIDATION_ERROR"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED")
    })
    @PreAuthorize("hasRole('MEMBER')")
    @PatchMapping("/me")
    public ApiResponse<MeResponse> updateProfile(
            @Valid @RequestBody UpdateProfileRequest request,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        return ApiResponse.of(profileService.updatePhone(principal.memberId(), request.phone()));
    }

    @Operation(summary = "비밀번호 변경",
            description = """
                    현재 비밀번호를 함께 보냅니다 — 로그인해 있다는 것만으로는
                    부족합니다. 자리를 비운 사이 남이 브라우저를 만지면 비밀번호를
                    바꿔 계정을 통째로 가져갈 수 있습니다.

                    ⚠️ **다른 기기의 세션이 전부 끊깁니다.** 비밀번호를 바꾸는 이유가
                    "누가 내 계정을 쓰는 것 같다"인 경우가 많은데, 기존 세션을
                    살려두면 정작 그 사람은 그대로 남습니다.

                    **이 기기는 로그인 상태가 유지됩니다** — 새 쿠키가 함께 나갑니다.

                    카카오로 가입한 계정에는 비밀번호가 없어 `VALIDATION_ERROR`입니다.
                    현재 비밀번호가 틀리면 401이 아니라 **400**입니다 — 로그인은
                    멀쩡한데 입력값만 틀린 상황이라, 401을 주면 FE가 로그인 화면으로
                    튕겨 사용자가 이유를 알 수 없게 됩니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "204", description = "변경 완료 — 다른 기기 로그아웃됨"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400", ref = "#/components/responses/VALIDATION_ERROR"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED")
    })
    @PreAuthorize("hasRole('MEMBER')")
    @PostMapping("/password/change")
    public ResponseEntity<Void> changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        Instant now = Instant.now();
        Member member = profileService.changePassword(
                principal.memberId(), request.currentPassword(), request.newPassword(), now);

        // 방금 전 기기의 리프레시 토큰까지 폐기됐다. 새로 발급해 이 기기만
        // 로그인 상태를 잇는다 — 안 하면 비밀번호를 바꾼 사람이 곧바로 튕긴다.
        // noContent()는 HeadersBuilder라 쿠키 헬퍼(BodyBuilder)에 넘길 수 없다
        return withAuthCookies(
                ResponseEntity.status(HttpStatus.NO_CONTENT), authService.issueFor(member, now))
                .build();
    }

    @Operation(summary = "회원 탈퇴",
            description = """
                    회원 행을 **삭제**합니다. 개인정보 즉시 파기(NFR-PRIV-06).

                    **명단은 다시 열립니다.** 탈퇴는 "이 서비스를 그만 쓴다"이지
                    "교회를 떠난다"가 아니라, 마음이 바뀌면 다시 가입할 수 있어야
                    합니다. 명단 행 자체는 교회의 기록이라 지우지 않습니다.

                    ⚠️ **`password`는 비밀번호가 있는 계정에만 필요합니다.** 카카오로
                    가입했다면 확인할 비밀번호가 없어, 필수로 두면 그 사람들은 탈퇴할
                    수 없습니다 — 로그인 세션 자체를 본인 확인으로 봅니다.

                    ⚠️ **마지막 전도사는 탈퇴할 수 없습니다** — 나가고 나면 아무도
                    회원을 관리할 수 없습니다 (§8.3 자기잠금 방지와 같은 규칙).
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "204", description = "탈퇴 완료 — 쿠키 삭제됨"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400", ref = "#/components/responses/VALIDATION_ERROR"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED")
    })
    @PreAuthorize("hasRole('MEMBER')")
    @DeleteMapping("/me")
    public ResponseEntity<Void> withdraw(
            @RequestBody(required = false) WithdrawRequest request,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        profileService.withdraw(principal.memberId(),
                request == null ? null : request.password(), Instant.now());

        // 계정이 사라졌으니 쿠키도 지운다. 남겨두면 브라우저가 죽은 토큰을
        // 계속 보내고, 사용자는 로그인한 것처럼 보이는 화면에서 401만 받는다.
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, AuthCookies.expireAccess(secureCookie).toString())
                .header(HttpHeaders.SET_COOKIE, AuthCookies.expireRefresh(secureCookie).toString())
                .build();
    }

    /**
     * 두 토큰 쿠키를 함께 싣는다.
     *
     * <p>쿠키의 만료는 토큰 자체의 TTL과 같은 값을 쓴다 — 쿠키가 더 오래 살면
     * 브라우저는 이미 죽은 토큰을 계속 보내고, 더 짧으면 멀쩡한 토큰을 잃는다.
     */
    private ResponseEntity.BodyBuilder redirect(String url) {
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(url));
    }

    private ResponseEntity.BodyBuilder withAuthCookies(AuthService.Issued issued) {
        return withAuthCookies(ResponseEntity.ok(), issued);
    }

    /**
     * 두 토큰 쿠키를 주어진 응답에 싣는다.
     *
     * <p>상태 코드를 받는 형태인 이유 — 카카오 콜백(§2.8)은 <b>302와 함께</b>
     * 쿠키를 심어야 한다. 200으로 고정해 두면 그쪽에서 쓸 수 없다.
     */
    private ResponseEntity.BodyBuilder withAuthCookies(
            ResponseEntity.BodyBuilder builder, AuthService.Issued issued) {

        ResponseCookie access = AuthCookies.access(
                issued.accessToken(), jwtProperties.accessDuration(), secureCookie);
        ResponseCookie refresh = AuthCookies.refresh(
                issued.refreshToken(), jwtProperties.refreshDuration(), secureCookie);

        return builder
                .header(HttpHeaders.SET_COOKIE, access.toString())
                .header(HttpHeaders.SET_COOKIE, refresh.toString());
    }
}
