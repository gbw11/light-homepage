package kr.light.album;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import kr.light.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 오래된 앨범 정리 — R2 용량 회수 (SPEC_API.md §6.11).
 *
 * <p><b>권한 {@code T}(전도사) 전용이다.</b> 앨범 열람·삭제는 {@code L}(임원)
 * 부터인데 여기만 한 칸 높다.
 *
 * <p>⚠️ <b>임원이 못 하는 일을 막는 것이 아니다.</b> 임원은
 * {@code DELETE /api/albums/{id}}로 앨범을 하나씩 지울 수 있으므로, 이 경로를
 * 막아도 같은 결과에 도달할 수 있다. 여기서 노리는 것은 <b>사고 범위</b>다 —
 * 한 번의 호출로 여러 앨범이 되돌릴 수 없이 사라지는 창구는 더 좁게 둔다.
 */
@Tag(name = "관리", description = "오래된 앨범 정리")
@RestController
@RequestMapping(value = "/api/admin/albums", produces = MediaType.APPLICATION_JSON_VALUE)
@PreAuthorize("hasRole('PASTOR')")
@RequiredArgsConstructor
public class AlbumPurgeController {

    private final AlbumPurgeService albumPurgeService;

    @Operation(summary = "정리 대상 미리보기",
            description = """
                    행사일이 오래된 앨범부터 보여줍니다. **아무것도 지우지 않습니다.**

                    ★ 응답의 `id`들을 그대로 `POST .../purge`의 `albumIds`에 넣으세요.
                    개수로 지우지 않는 이유는 그 사이에 더 오래된 행사일의 앨범이
                    생기면 **화면에서 본 것과 다른 앨범이 지워지기** 때문입니다.

                    ⚠️ **`eventDate`가 없는 앨범은 나오지 않습니다.** 언제 찍은
                    것인지 모르는 앨범을 "오래됐다"고 판단할 근거가 없습니다.
                    그런 앨범은 `DELETE /api/albums/{id}`로 직접 지정하세요.

                    `sizeBytes`는 **커밋된 사진**의 합계입니다. 커밋되지 않은
                    사진은 `size_bytes`가 0이라 여기에 안 잡히지만, 삭제할 때는
                    그 R2 객체도 함께 지워집니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200", description = "조회 성공"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", ref = "#/components/responses/FORBIDDEN")
    })
    @GetMapping("/purge-candidates")
    public ApiResponse<List<AlbumPurgeCandidate>> candidates(
            @Parameter(description = "기본 5, 최대 20")
            @RequestParam(required = false) Integer count
    ) {
        return ApiResponse.of(albumPurgeService.candidates(count));
    }

    @Operation(summary = "정리 실행",
            description = """
                    ⚠️ **되돌릴 수 없습니다.** 사진 · R2 객체 · DB 행을 모두
                    지웁니다. 원본을 보관하지 않으므로 복구 경로가 없습니다.
                    확인 다이얼로그 없이 부르지 마세요.

                    커밋되지 않은 `PENDING` 사진의 R2 객체까지 지웁니다 —
                    남기면 아무도 가리키지 않는 고아 객체가 됩니다.

                    없는 `albumIds`가 섞여 있으면 `404`로 **전체가 실패합니다.**
                    일부만 지워진 상태로 끝나는 것보다 아무것도 지우지 않는
                    편이 낫기 때문입니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200", description = "정리 완료"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400", ref = "#/components/responses/VALIDATION_ERROR"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", ref = "#/components/responses/FORBIDDEN"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "404", ref = "#/components/responses/NOT_FOUND")
    })
    @PostMapping("/purge")
    public ApiResponse<AlbumPurgeResponse> purge(@Valid @RequestBody AlbumPurgeRequest request) {
        return ApiResponse.of(albumPurgeService.purge(request.albumIds()));
    }
}
