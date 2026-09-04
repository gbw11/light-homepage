package kr.light.upload;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import kr.light.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 사진 업로드 (SPEC_API.md §6.5 · §6.6). 전 경로 임원(L).
 *
 * <p><b>⚠️ 파일이 이 서버를 통과하지 않는다.</b> 브라우저가 R2로 직접 올리고
 * 우리는 허가증만 발급한다 — 무료 인스턴스(512MB)에서 수백 장의 스트림을
 * 받으면 메모리가 터진다.
 */
@Tag(name = "사진첩", description = "사진 업로드 (임원)")
@RestController
// ⚠️ 클래스에 경로를 두지 않는다. `/api/uploads` + `:issue`를 스프링이
//    `/api/uploads/:issue`로 합쳐버려 계약(`/api/uploads:issue`)과 어긋난다.
@RequestMapping(produces = MediaType.APPLICATION_JSON_VALUE)
@PreAuthorize("hasRole('LEADER')")
@RequiredArgsConstructor
public class UploadController {

    private final UploadService uploadService;

    @Operation(summary = "업로드 URL 발급",
            description = """
                    presigned PUT URL을 장당 2개(view · thumb) 발급합니다.
                    **유효 15분** — 200장은 배치로 나눠 받으세요.

                    ⚠️ `sizeBytes`·`width` 등은 **리사이즈 후** 값입니다. 서버가
                    이 값으로 용량 한도를 검사하므로, 촬영 원본 크기를 보내면
                    멀쩡한 업로드가 `STORAGE_LIMIT`으로 막힙니다.

                    ★ **재시도는 같은 `photoId`로 다시 발급**받으세요. 새로
                    발급받으면 앞의 행과 객체가 고아로 남습니다.

                    `photos` 행이 `PENDING`으로 생깁니다. 24시간 안에 확정(§6.6)
                    하지 않으면 행과 R2 객체가 함께 정리됩니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200", description = "발급 성공"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400", ref = "#/components/responses/VALIDATION_ERROR"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", ref = "#/components/responses/FORBIDDEN"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "404", ref = "#/components/responses/NOT_FOUND"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "409", description = "용량 95% 초과 (STORAGE_LIMIT)")
    })
    @PostMapping(value = "/api/uploads:issue", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ApiResponse<Map<String, List<UploadTicket>>> issue(
            @Valid @RequestBody UploadIssueRequest request
    ) {
        return ApiResponse.of(Map.of("uploads", uploadService.issue(request)));
    }

    @Operation(summary = "업로드 확정",
            description = """
                    **20장 배치**로 부르세요 (200회 호출은 낭비입니다).

                    ★ **서버가 R2에 직접 확인합니다.** 클라이언트가 말한 크기를
                    믿지 않습니다 — 업로드가 실패했는데 확정만 부를 수 있고,
                    그러면 목록에 깨진 이미지가 뜨고 용량 집계가 틀어집니다.

                    ⚠️ **일부 실패는 200입니다.** 20장 중 한 장이 실패했다고
                    전체를 되돌리면 성공한 19장까지 다시 올려야 합니다.
                    `failed`에 담긴 것만 재시도하세요.

                    이미 확정된 사진을 다시 보내면 `committed`에 들어갑니다 —
                    재시도가 영원히 실패로 남지 않게 하기 위해서입니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200", description = "처리 완료 (일부 실패 포함)"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400", ref = "#/components/responses/VALIDATION_ERROR"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", ref = "#/components/responses/FORBIDDEN")
    })
    @PostMapping(value = "/api/uploads:commit", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ApiResponse<UploadCommitResponse> commit(
            @Valid @RequestBody UploadCommitRequest request
    ) {
        return ApiResponse.of(uploadService.commit(request));
    }
}
