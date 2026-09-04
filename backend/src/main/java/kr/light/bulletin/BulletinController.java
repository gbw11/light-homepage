package kr.light.bulletin;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotNull;
import kr.light.auth.AuthPrincipal;
import kr.light.common.ApiException;
import kr.light.common.ApiResponse;
import kr.light.common.PageResponse;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 주보 (SPEC_API.md §5).
 *
 * <p>⚠️ <b>읽기는 비로그인에게 열려 있다</b> (§10). 주보는 교회 밖에서도 보는
 * 공개 자료다 — 그래서 클래스 단위로 인가를 걸지 않고, 쓰기 두 개에만 건다.
 */
@Tag(name = "주보", description = "주보 열람 · 업로드")
@RestController
@RequestMapping(value = "/api/bulletins", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class BulletinController {

    private final BulletinService bulletinService;
    private final MemberRepository memberRepository;

    @Operation(summary = "가장 최근 주보",
            description = """
                    ⚠️ **주보가 하나도 없으면 `data`가 `null`입니다** — 404가 아닙니다.
                    "아직 안 올라옴"은 오류가 아니라 정상 상태입니다.

                    `pages[].url`은 **10분짜리 presigned URL**입니다. 화면을 오래
                    열어두면 만료되므로, 만료 후에는 다시 조회해야 합니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200", description = "조회 성공 (없으면 data: null)")
    })
    @GetMapping("/latest")
    public ApiResponse<BulletinResponse> latest() {
        return ApiResponse.of(bulletinService.latest().orElse(null));
    }

    @Operation(summary = "지난 주보 목록",
            description = """
                    최근 주일이 위입니다.

                    ⚠️ `thumbUrl`은 **별도 썸네일이 아니라 1쪽 원본**(장변 2048px)입니다.
                    FE가 2048px WebP만 올리고 서버는 이미지를 재가공하지 않습니다 —
                    WebP 디코딩을 512MB 인스턴스에서 하지 않기 위해서입니다.
                    화면에서 크기를 줄여 쓰고, 목록이 길면 지연 로딩하세요.
                    """)
    @GetMapping
    public ApiResponse<PageResponse<BulletinSummaryResponse>> list(
            @Parameter(description = "0부터. 기본 0")
            @RequestParam(required = false) Integer page,

            @Parameter(description = "기본 20, 최대 100")
            @RequestParam(required = false) Integer size
    ) {
        return ApiResponse.of(bulletinService.list(
                BulletinService.normalizePage(page), BulletinService.normalizeSize(size)));
    }

    @Operation(summary = "주보 상세", description = "`/latest`와 같은 형태입니다.")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200", description = "조회 성공"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "404", ref = "#/components/responses/NOT_FOUND")
    })
    @GetMapping("/{id}")
    public ApiResponse<BulletinResponse> get(@PathVariable Long id) {
        return ApiResponse.of(bulletinService.get(id));
    }

    @Operation(summary = "주보 업로드",
            description = """
                    `multipart/form-data`입니다.

                    ★ **`pages`의 순서가 그대로 페이지 번호입니다.** 정렬 기준이
                    따로 없으므로 서버는 받은 순서를 씁니다.

                    ⚠️ **사진첩과 전송 경로가 다릅니다.** 사진은 브라우저가 R2로
                    직접 올리지만(§6.5), 주보는 서버를 통과합니다 — 2~4장이라
                    비용이 문제가 아니고 순서를 한 요청에서 확정하는 편이 안전합니다.

                    같은 날짜가 이미 있으면 `DUPLICATE`입니다. **교체 여부를 화면이
                    물어본 뒤 삭제하고 다시 올리세요** — 서버가 조용히 덮어쓰지
                    않습니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "201", description = "업로드 완료"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400", ref = "#/components/responses/VALIDATION_ERROR"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", ref = "#/components/responses/FORBIDDEN"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "409", description = "같은 날짜 존재(DUPLICATE) 또는 용량 초과(STORAGE_LIMIT)")
    })
    @PreAuthorize("hasRole('LEADER')")
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> create(
            @Parameter(description = "주일 날짜 (YYYY-MM-DD)")
            @RequestParam @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate serviceDate,

            // ⚠️ required = false다. 파트가 아예 없으면 스프링이 먼저 예외를 던져
            //    500이 나가는데, 그건 사용자 입력 오류이므로 400이어야 한다.
            //    비어 있는 경우의 판단은 BulletinService.validate가 한다.
            @Parameter(description = "페이지 이미지. 배열 순서가 페이지 순서다")
            @RequestParam(name = "pages", required = false) List<MultipartFile> pages,

            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        BulletinService.Created created =
                bulletinService.create(serviceDate, pages, actor(principal));

        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(
                Map.of("id", created.id(), "pageCount", created.pageCount())));
    }

    @Operation(summary = "주보 삭제",
            description = "⚠️ **R2 객체까지 지웁니다.** 남기면 용량이 조용히 샙니다.")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "204", description = "삭제 완료"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", ref = "#/components/responses/FORBIDDEN"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "404", ref = "#/components/responses/NOT_FOUND")
    })
    @PreAuthorize("hasRole('LEADER')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        bulletinService.delete(id);
        return ResponseEntity.noContent().build();
    }

    /** 올린 사람. {@code AuthPrincipal}은 id와 역할만 들고 있다 */
    private Member actor(AuthPrincipal principal) {
        return memberRepository.findById(principal.memberId())
                .orElseThrow(ApiException::unauthorized);
    }
}
