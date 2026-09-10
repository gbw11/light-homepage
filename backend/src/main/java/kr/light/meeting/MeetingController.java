package kr.light.meeting;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import kr.light.auth.AuthPrincipal;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import kr.light.common.ApiException;
import kr.light.common.ClientAddress;
import kr.light.common.ApiResponse;
import kr.light.common.PageResponse;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

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
    private final MeetingUploadService meetingUploadService;
    private final MeetingPageService meetingPageService;
    private final MemberRepository memberRepository;

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

    @Operation(summary = "월례회 페이지 이미지 ★",
            description = """
                    **응답이 JSON이 아니라 이미지 바이너리**(`image/jpeg`)입니다.

                    ★ **워터마크가 픽셀에 태워져 나갑니다** — `{이름} {연락처 뒷4자리}`
                    + 열람시각 + 문서ID. CSS 오버레이가 아니라 이미지 자체라
                    **캡처한 그림에도 그대로 남습니다.**

                    ⚠️ **presigned URL을 발급하지 않습니다.** 발급하면 열람 기간이
                    끝난 뒤에도 URL이 만료 전까지 살아 있고 공유 가능해집니다.
                    서버가 직접 읽어 합성해서 보냅니다.

                    ⚠️ **화면 캡처는 막을 수 없습니다** (`ARCHITECTURE §7.7`).
                    워터마크는 막는 장치가 아니라, 막을 수 없어서 넣은 **추적
                    장치**입니다. 화면 문구가 이보다 강하게 약속하면 사용자에게
                    거짓말이 됩니다.

                    기간이 지났으면 **403**입니다 (`L`↑는 통과). 열람은
                    `meeting_doc_views`에 기록됩니다 (§7.7).
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200", description = "이미지 바이너리"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", description = "열람 기간이 아님"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "404", ref = "#/components/responses/NOT_FOUND")
    })
    @GetMapping(value = "/{id}/pages/{pageNo}", produces = MediaType.IMAGE_JPEG_VALUE)
    public ResponseEntity<byte[]> page(
            @PathVariable Long id,
            @PathVariable int pageNo,
            @AuthenticationPrincipal AuthPrincipal principal,
            HttpServletRequest request
    ) {
        Member viewer = actor(principal);
        byte[] image = meetingPageService.render(id, pageNo, viewer);

        // ⚠️ 응답을 만든 **뒤에** 기록한다. 기록이 실패해도 자료는 보여야 한다
        meetingPageService.recordView(id, pageNo, viewer,
                ClientAddress.of(request), request.getHeader("User-Agent"));

        return ResponseEntity.ok()
                // ⚠️ 캐시를 금지한다. 워터마크에 열람시각이 들어 있어 캐시되면
                //    다른 사람이 남의 워터마크가 박힌 페이지를 볼 수 있다
                .cacheControl(CacheControl.noStore().mustRevalidate())
                .header(HttpHeaders.PRAGMA, "no-cache")
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .contentType(MediaType.IMAGE_JPEG)
                .body(image);
    }

    @Operation(summary = "열람 기록",
            description = """
                    ⚠️ **유출 시 워터마크와 대조하는 근거입니다** (§7.7). 그래서
                    이름이 그대로 나갑니다 — 가리면 대조가 안 됩니다.

                    한 사람이 페이지마다 행을 남기므로 **사람 단위로 접어서**
                    보여줍니다. `maxPageNo`는 그 사람이 가장 멀리 본 페이지입니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200", description = "조회 성공"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", ref = "#/components/responses/FORBIDDEN"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "404", ref = "#/components/responses/NOT_FOUND")
    })
    @PreAuthorize("hasRole('LEADER')")
    @GetMapping("/{id}/views")
    public ApiResponse<MeetingViewsResponse> views(
            @PathVariable Long id,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size
    ) {
        return ApiResponse.of(meetingQueryService.views(id,
                MeetingQueryService.normalizePage(page),
                MeetingQueryService.normalizeSize(size)));
    }

    // ── 관리 (임원) ──────────────────────────────────────────────────

    @Operation(summary = "월례회 자료 업로드",
            description = """
                    `multipart/form-data`로 **PDF**를 보냅니다 (Word에서 「PDF로 저장」).

                    ⚠️ **동기 처리입니다.** 서버가 PDFBox로 페이지 이미지(장변
                    2048px JPEG)로 변환하고, 10페이지 기준 **15~30초** 걸립니다.
                    FE는 진행 상태를 표시하세요.

                    ★ **업로드한 PDF 원본은 보관하지 않습니다.** 남기면 그 자체가
                    유출 경로가 됩니다 — 워터마크도 없고 열람 기간도 걸리지 않은
                    원본이 저장소에 있는 셈이기 때문입니다.

                    페이지 순서는 PDF 순서를 따르고, 최대 50쪽입니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "201", description = "업로드·변환 완료"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400", ref = "#/components/responses/VALIDATION_ERROR"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", ref = "#/components/responses/FORBIDDEN"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "409", description = "용량 초과 (STORAGE_LIMIT)")
    })
    @PreAuthorize("hasRole('LEADER')")
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> create(
            @RequestParam String title,

            @Parameter(description = "월례회 날짜 (YYYY-MM-DD)")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate meetingDate,

            @Parameter(description = "열람 시작 (ISO-8601 UTC)")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant viewableFrom,

            @Parameter(description = "열람 종료. 시작보다 뒤여야 한다")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant viewableUntil,

            @Parameter(description = "PDF 파일")
            @RequestParam(name = "file", required = false) MultipartFile file,

            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        MeetingUploadService.Created created = meetingUploadService.create(
                title, meetingDate, viewableFrom, viewableUntil, file, actor(principal));

        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(
                Map.of("id", created.id(), "pageCount", created.pageCount())));
    }

    @Operation(summary = "열람 기간 수정",
            description = "연장·조기 종료. 자료를 다시 올리지 않고 기간만 바꿉니다.")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "204", description = "변경 완료"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400", ref = "#/components/responses/VALIDATION_ERROR"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", ref = "#/components/responses/FORBIDDEN"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "404", ref = "#/components/responses/NOT_FOUND")
    })
    @PreAuthorize("hasRole('LEADER')")
    @PatchMapping("/{id}/window")
    public ResponseEntity<Void> changeWindow(
            @PathVariable Long id,
            @Valid @RequestBody MeetingWindowRequest request
    ) {
        meetingUploadService.changeWindow(id, request.viewableFrom(), request.viewableUntil());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "월례회 자료 삭제",
            description = "⚠️ **페이지 이미지까지 지웁니다.**")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "204", description = "삭제 완료"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", ref = "#/components/responses/FORBIDDEN"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "404", ref = "#/components/responses/NOT_FOUND")
    })
    @PreAuthorize("hasRole('LEADER')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        meetingUploadService.delete(id);
        return ResponseEntity.noContent().build();
    }

    private Member actor(AuthPrincipal principal) {
        return memberRepository.findById(principal.memberId())
                .orElseThrow(ApiException::unauthorized);
    }
}
