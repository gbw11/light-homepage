package kr.light.push;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import kr.light.auth.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

/**
 * 푸시를 받을 기기 (SPEC_API.md §15.2) — 로그인한 회원 누구나(M).
 *
 * <p>공개 알림(공개 공지 · 주보)은 앱이 주제를 구독해 받으므로 등록이 필요 없다.
 * 이 등록은 <b>회원 공지 · 새가족 신청</b>처럼 로그인한 사람에게만 가는 알림용이다.
 */
@Tag(name = "푸시 알림", description = "알림을 받을 기기 등록 · 해제")
@RestController
@RequestMapping(value = "/api/me/devices", produces = MediaType.APPLICATION_JSON_VALUE)
@PreAuthorize("hasRole('MEMBER')")
@RequiredArgsConstructor
public class DeviceController {

    private final DeviceService deviceService;

    @Operation(summary = "기기 등록",
            description = """
                    이 기기의 FCM 토큰을 내 계정에 등록합니다. **멱등**입니다 — 앱을 켤 때 ·
                    로그인할 때 · 토큰이 바뀔 때마다 불러도 한 줄입니다.

                    같은 기기에서 다른 사람이 로그인하면 **토큰의 주인이 바뀝니다** —
                    앞 사람의 회원 알림이 계속 가지 않습니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "204", description = "등록됨"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400", ref = "#/components/responses/VALIDATION_ERROR"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED")
    })
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Void> register(
            @Valid @RequestBody DeviceRegisterRequest request,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        deviceService.register(principal.memberId(), request, Instant.now());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "기기 해제",
            description = """
                    로그아웃할 때 부릅니다. **로그아웃(`POST /api/auth/logout`) 전에** 부르세요 —
                    로그아웃 뒤에는 로그인이 없어 401입니다.

                    내 기기만 지웁니다. 없는 토큰 · 남의 토큰이어도 똑같이 `204`입니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "204", description = "해제됨 (없어도 같음)"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED")
    })
    @DeleteMapping("/{token}")
    public ResponseEntity<Void> unregister(
            @Parameter(description = "등록할 때 보낸 FCM 토큰") @PathVariable String token,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        deviceService.unregister(principal.memberId(), token);
        return ResponseEntity.noContent().build();
    }
}
