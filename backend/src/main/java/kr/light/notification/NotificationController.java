package kr.light.notification;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import kr.light.auth.AuthPrincipal;
import kr.light.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

/**
 * 전도사·임원 알림 (SPEC_API.md §14).
 *
 * <p>권한 {@code L}(임원) 이상 — 새가족 신청 목록(§8.6)과 같은 대역이다.
 * 알림에 신청자 <b>이름</b>이 들어가므로 그보다 넓힐 수 없고, 좁히면 임원이
 * 새가족이 왔다는 것을 알 수 없다.
 *
 * <p><b>[CONTRACT]</b> §9.1은 "성공 시 담당자에게 알림 메일"로 적혀 있었다.
 * 메일 발신 도메인 결정이 나지 않아 몇 달간 아무에게도 알려지지 않았고,
 * 웹 알림으로 바꿨다 (2026-09-09). §14가 새로 생긴 절이다.
 */
@Tag(name = "관리", description = "전도사·임원 알림")
@RestController
@RequestMapping(value = "/api/admin/notifications", produces = MediaType.APPLICATION_JSON_VALUE)
@PreAuthorize("hasRole('LEADER')")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @Operation(summary = "안 읽은 알림",
            description = """
                    배지에 쓸 개수와 목록을 함께 줍니다. 최근이 위입니다.

                    ★ **`unreadCount`로 배지를 만드세요.** `items`는 20건에서
                    잘리므로 길이를 세면 21건부터 계속 20입니다.

                    ★ 응답의 `readMarker`를 그대로 `POST .../read`의 `until`에
                    넣으면, 읽는 사이에 들어온 새 알림은 안 읽음으로 남습니다.

                    ⚠️ **밀어주지 않습니다.** 필요한 만큼 주기적으로 부르세요
                    (30초~1분 정도면 충분합니다 — 새가족 연락은 초 단위로
                    급한 일이 아닙니다).

                    ⚠️ 아직 한 번도 읽지 않은 계정에는 **남아 있는 신청이 전부**
                    안 읽음으로 보입니다. 보유기간이 1년이라 그만큼입니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200", description = "조회 성공"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", ref = "#/components/responses/FORBIDDEN")
    })
    @GetMapping
    public ApiResponse<NotificationListResponse> unread(
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        return ApiResponse.of(notificationService.unread(principal.memberId()));
    }

    @Operation(summary = "읽음 처리",
            description = """
                    ★ **읽음은 사람별입니다.** 임원 한 명이 눌러도 다른 사람의
                    배지는 그대로입니다 — 열어본 것과 실제로 연락한 것은
                    다르기 때문입니다.

                    본문은 생략할 수 있습니다. 그 경우 **서버 시각까지 전부**
                    읽음이 되어, 목록을 본 뒤 들어온 알림까지 사라질 수
                    있습니다. 목록 응답의 `readMarker`를 넣는 쪽을 권합니다.

                    같은 요청을 여러 번 보내도 안전합니다. 표시는 뒤로
                    되돌아가지 않습니다 — 이미 읽은 알림이 되살아나지
                    않습니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200", description = "처리 성공"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", ref = "#/components/responses/FORBIDDEN")
    })
    // ⚠️ consumes를 걸지 않는다. 걸면 본문 없는 요청이 Content-Type이 없어
    //    403·400도 아닌 415가 된다 — "모두 읽음"을 못 누르게 된다
    @PostMapping("/read")
    public ApiResponse<NotificationReadResponse> markRead(
            @AuthenticationPrincipal AuthPrincipal principal,

            // ⚠️ required = false — 본문 없이 "모두 읽음"을 누를 수 있어야 한다.
            //    @Valid를 붙이지 않은 이유는 NotificationReadRequest 참고
            //    (검증이 @PreAuthorize보다 먼저 돌아 403이 400으로 바뀐다)
            @RequestBody(required = false) NotificationReadRequest request
    ) {
        return ApiResponse.of(notificationService.markRead(
                principal.memberId(),
                request == null ? null : request.until(),
                Instant.now()));
    }
}
