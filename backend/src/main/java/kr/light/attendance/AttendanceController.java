package kr.light.attendance;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import kr.light.auth.AuthPrincipal;
import kr.light.common.ApiException;
import kr.light.common.ApiResponse;
import kr.light.common.PageResponse;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 출석부 (SPEC_API.md §13).
 *
 * <p><b>⚠️ 클래스 전체에 {@code @PreAuthorize("hasRole('LEADER')")}를 건다.</b>
 * 출석 기록은 "누가 교회에 안 나왔는지"의 기록이라 예산안과 같은 급의 민감
 * 정보다 (§13.0). 메서드마다 달면 새 메서드에서 빠뜨릴 수 있는데, 여기서
 * 빠뜨리면 회원 전체에게 열린다.
 *
 * <p>본인 출결 조회({@code /attendance/me})와 마을별 통계는 1차 범위에서
 * 제외됐다 (§9-E 권장안 채택).
 */
@Tag(name = "출석부", description = "회차 관리 · 출결 기록 (임원 이상)")
@RestController
@RequestMapping(value = "/api/attendance", produces = MediaType.APPLICATION_JSON_VALUE)
@PreAuthorize("hasRole('LEADER')")
@RequiredArgsConstructor
public class AttendanceController {

    private final AttendanceService attendanceService;
    private final MemberRepository memberRepository;

    @Operation(summary = "회차 목록",
            description = """
                    날짜 내림차순입니다.

                    `checkedCount`(상태가 기록된 인원) · `presentCount`(PRESENT 인원) ·
                    `rosterCount`(active 명단 전체)가 함께 나갑니다 — 목록 화면이
                    **"체크 4/15"** 진행 상태를 회차마다 상세 조회 없이 보여주기
                    위한 집계입니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200", description = "조회 성공"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", ref = "#/components/responses/FORBIDDEN")
    })
    @GetMapping("/sessions")
    public ApiResponse<PageResponse<SessionSummaryResponse>> sessions(
            @Parameter(description = "0부터. 기본 0")
            @RequestParam(required = false) Integer page,

            @Parameter(description = "기본 20, 최대 100")
            @RequestParam(required = false) Integer size
    ) {
        return ApiResponse.of(attendanceService.list(
                AttendanceService.normalizePage(page), AttendanceService.normalizeSize(size)));
    }

    @Operation(summary = "회차 생성",
            description = """
                    ⚠️ **같은 날짜 + 같은 종류는 하나만** 만들 수 있습니다 (`DUPLICATE`).
                    회차가 둘 생기면 출결이 갈라져 "누가 체크했는지"를 알 수 없게 됩니다.

                    `type`은 `SUNDAY_SERVICE` 또는 `ETC`입니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "201", description = "생성 완료"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400", ref = "#/components/responses/VALIDATION_ERROR"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", ref = "#/components/responses/FORBIDDEN"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "409", ref = "#/components/responses/DUPLICATE")
    })
    @PostMapping("/sessions")
    public ResponseEntity<ApiResponse<Map<String, String>>> createSession(
            @Valid @RequestBody CreateSessionRequest request,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        String id = attendanceService.create(request, actor(principal));
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.of(Map.of("id", id)));
    }

    @Operation(summary = "회차 상세 — 명단 전원의 출결",
            description = """
                    `entries`는 **명단 전원**입니다 (체크된 사람만이 아닙니다).
                    체크 화면이 명단을 훑으며 상태를 찍는 방식이라, 아직 체크하지
                    않은 사람도 `status: null`로 함께 내려갑니다.

                    ⚠️ **`status: null`은 `ABSENT`와 다릅니다** — "아무도 체크하지
                    않음"입니다. 화면과 집계가 이 둘을 구별해야 합니다.

                    정렬은 마을 → 이름입니다 (체크 화면이 마을 단위로 도는 것을 전제).
                    마을 미지정(`village: null`)은 맨 뒤에 옵니다.

                    ⚠️ 전화번호·생년월일은 싣지 않습니다 — 체크에 필요한 값만 담습니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200", description = "조회 성공"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", ref = "#/components/responses/FORBIDDEN"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "404", ref = "#/components/responses/NOT_FOUND")
    })
    @GetMapping("/sessions/{id}")
    public ApiResponse<SessionDetailResponse> session(@PathVariable Long id) {
        return ApiResponse.of(attendanceService.get(id));
    }

    @Operation(summary = "출결 기록 (upsert)",
            description = """
                    ⚠️ **요청 본문이 배열 그 자체입니다** — envelope가 없습니다.

                    ```json
                    [ { "rosterId": "5", "status": "PRESENT" },
                      { "rosterId": "6", "status": "ABSENT" } ]
                    ```

                    ★ **전체 교체가 아니라 upsert입니다.** 보낸 항목만 덮고 나머지는
                    그대로 둡니다. **두 임원이 동시에 서로 다른 마을을 체크하는 것이
                    정상 흐름**이라, 전체 교체로 구현하면 서로의 기록을 덮어씁니다.
                    변경분만 보내주세요.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "204", description = "기록 완료"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400", ref = "#/components/responses/VALIDATION_ERROR"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", ref = "#/components/responses/FORBIDDEN"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "404", ref = "#/components/responses/NOT_FOUND")
    })
    @PutMapping("/sessions/{id}/entries")
    public ResponseEntity<Void> upsertEntries(
            @PathVariable Long id,
            @Valid @RequestBody List<EntryUpsertRequest> entries,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        attendanceService.upsertEntries(id, entries, actor(principal));
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "회차 삭제",
            description = """
                    출결 기록까지 함께 사라집니다.

                    FE는 1차에서 삭제 버튼을 두지 않았습니다 (실수 삭제 비용이
                    기능 가치보다 큼). API만 준비해 둡니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "204", description = "삭제 완료"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", ref = "#/components/responses/FORBIDDEN"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "404", ref = "#/components/responses/NOT_FOUND")
    })
    @DeleteMapping("/sessions/{id}")
    public ResponseEntity<Void> deleteSession(@PathVariable Long id) {
        attendanceService.delete(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * 기록한 사람. {@code AuthPrincipal}은 id와 역할만 들고 있어 실제 회원을 읽어온다.
     *
     * <p>두 임원이 나눠 체크하는 것이 정상 흐름이라 "누가 찍었는지"를 남긴다.
     */
    private Member actor(AuthPrincipal principal) {
        return memberRepository.findById(principal.memberId())
                .orElseThrow(ApiException::unauthorized);
    }
}
