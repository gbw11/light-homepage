package kr.light.meeting;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import kr.light.auth.AuthPrincipal;
import kr.light.common.ApiResponse;
import kr.light.common.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 월례회 자료 (SPEC_API.md §7).
 *
 * <p><b>⚠️ 열람은 회원(M)부터다.</b> §7 본문에는 {@code 권한 G}와 익명 처리
 * 서술이 남아 있지만, <b>§10 인가 매트릭스(테스트 기준)가 401</b>이고 FE도
 * 두 화면을 {@code MemberGate}로 막아두었다. 무엇보다
 * {@code meeting_doc_views.member_id}가 {@code NOT NULL}이라 <b>익명 열람은
 * 기록 자체가 불가능</b>하다 — 유출 추적이 목적인 기능에서 그건 앞뒤가 맞지
 * 않는다. 2026-09-04에 {@code M}으로 확정했다.
 *
 * <p>클래스 단위로 {@code hasRole('MEMBER')}를 걸어 기본을 막힘으로 둔다.
 * 관리 경로는 메서드 단위 {@code hasRole('LEADER')}가 덮어쓴다.
 */
@Tag(name = "월례회", description = "월례회 자료 열람 (회원) · 관리 (임원)")
@RestController
@RequestMapping(value = "/api/meetings", produces = MediaType.APPLICATION_JSON_VALUE)
@PreAuthorize("hasRole('MEMBER')")
@RequiredArgsConstructor
public class MeetingController {

    private final MeetingQueryService meetingQueryService;

    @Operation(summary = "월례회 자료 목록",
            description = """
                    최근 월례회가 위입니다.

                    ⚠️ **종료된 자료도 목록에는 남습니다** — 존재는 알리되 내용은
                    막습니다. `status`로 구분하세요.

                    | `status` | 의미 |
                    |---|---|
                    | `SCHEDULED` | 열람 시작 전 |
                    | `OPEN` | 열람 가능 |
                    | `CLOSED` | 기간 종료 — 회원은 열람 불가 |

                    ⚠️ `status`는 저장된 값이 아니라 **요청 시각으로 계산**합니다.
                    화면을 오래 열어두면 실제 상태와 어긋날 수 있습니다.

                    ★ **임원 이상은 `status`와 무관하게 열람할 수 있습니다** —
                    자료를 올리고 관리하는 쪽이라 기간이 끝난 뒤에도 확인해야 합니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200", description = "조회 성공"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED")
    })
    @GetMapping
    public ApiResponse<PageResponse<MeetingSummaryResponse>> list(
            @Parameter(description = "0부터. 기본 0")
            @RequestParam(required = false) Integer page,

            @Parameter(description = "기본 20, 최대 100")
            @RequestParam(required = false) Integer size
    ) {
        return ApiResponse.of(meetingQueryService.list(
                MeetingQueryService.normalizePage(page),
                MeetingQueryService.normalizeSize(size)));
    }

    @Operation(summary = "월례회 자료 상세",
            description = """
                    `canView`가 **이 요청을 보낸 사람 기준**입니다 — 같은 자료라도
                    회원과 임원의 값이 다릅니다.

                    볼 수 없으면 `viewReason`이 이유를 담습니다:

                    | 값 | 의미 |
                    |---|---|
                    | `PERIOD_CLOSED` | 열람 기간이 끝났습니다 |
                    | `PERIOD_NOT_STARTED` | 아직 시작 전입니다 |

                    `remainingSeconds`는 종료까지 남은 초입니다. 이미 끝났거나
                    아직 시작 전이면 `0`입니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200", description = "조회 성공"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "404", ref = "#/components/responses/NOT_FOUND")
    })
    @GetMapping("/{id}")
    public ApiResponse<MeetingDetailResponse> get(
            @PathVariable Long id,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        return ApiResponse.of(meetingQueryService.get(id, principal.role()));
    }
}
