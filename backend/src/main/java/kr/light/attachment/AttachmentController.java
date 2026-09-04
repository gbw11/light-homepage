package kr.light.attachment;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import kr.light.auth.AuthPrincipal;
import kr.light.common.ApiResponse;
import kr.light.member.Role;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.util.Map;

/**
 * 게시물 첨부파일 (SPEC_API.md §4).
 *
 * <p>업로드는 임원(L), <b>다운로드는 원글의 권한을 상속</b>한다 — 그래서 두
 * 경로의 인가가 서로 다르고, 클래스 단위로 걸 수 없다.
 */
@Tag(name = "첨부파일", description = "첨부 업로드 · 다운로드")
@RestController
@RequiredArgsConstructor
public class AttachmentController {

    private final AttachmentService attachmentService;

    @Operation(summary = "첨부 업로드",
            description = """
                    이 시점에는 **어느 글에도 연결되지 않습니다.** 글을 저장할 때
                    `attachmentIds`로 연결하세요.

                    ⚠️ 연결하지 않으면 **24시간 뒤 파일까지 정리됩니다.** 업로드만
                    해두고 글을 나중에 쓰는 방식은 안전하지 않습니다.

                    ⚠️ 파일명은 서버가 경로 요소(`/`·`..`)를 걷어낸 값으로 저장됩니다.
                    응답의 `filename`이 실제 저장된 이름이고, 다운로드될 때도 그 이름입니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "201", description = "업로드 완료"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400", ref = "#/components/responses/VALIDATION_ERROR"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", ref = "#/components/responses/FORBIDDEN"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "409", description = "용량 초과 (STORAGE_LIMIT)")
    })
    @PreAuthorize("hasRole('LEADER')")
    @PostMapping(value = "/api/attachments",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> upload(
            @Parameter(description = "올릴 파일")
            @RequestParam(name = "file", required = false) MultipartFile file
    ) {
        AttachmentService.Uploaded uploaded = attachmentService.upload(file);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(Map.of(
                "id", uploaded.id(),
                "filename", uploaded.filename(),
                "sizeBytes", uploaded.sizeBytes())));
    }

    @Operation(summary = "첨부 내려받기 — 원글 권한을 상속",
            description = """
                    **302 리다이렉트**로 presigned URL(10분)을 줍니다.

                    ★ **파일 주소를 아는 것만으로 열리지 않습니다.** 첨부 id로 요청이
                    올 때마다 **원글의 분류를 다시 확인**합니다.

                    | 원글 분류 | 권한 |
                    |---|---|
                    | 공개공지 | `G` |
                    | 내부공지 · 회의록 | `M` |
                    | 예산안 | `L` |

                    ⚠️ 권한이 없으면 원글과 마찬가지로 **`404`** 입니다 — `403`을 주면
                    "그 파일이 있다"는 사실이 새어나가고, 예산안은 그 사실 자체가
                    민감합니다.

                    ⚠️ 아직 글에 연결되지 않은 첨부도 `404`입니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "302", description = "presigned URL로 리다이렉트"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "404", ref = "#/components/responses/NOT_FOUND")
    })
    @GetMapping("/api/files/{attachmentId}")
    public ResponseEntity<Void> download(
            @PathVariable Long attachmentId,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        // ⚠️ 비로그인이면 principal이 null이다 — 공개공지 첨부는 그 상태로 통과한다
        Role role = principal == null ? null : principal.role();

        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(attachmentService.downloadUrl(attachmentId, role)))
                .build();
    }
}
