package kr.light.storage;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import kr.light.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 저장 용량 현황 (SPEC_API.md §8.5).
 *
 * <p>권한 {@code L}(임원) 이상. 회원 관리(§8.1~§8.4)가 {@code P} 전용인 것과
 * 다르다 — 용량은 사진을 올리는 사람이 봐야 하는 값이다.
 */
@Tag(name = "관리", description = "저장 용량 현황")
@RestController
@RequestMapping(value = "/api/admin/storage", produces = MediaType.APPLICATION_JSON_VALUE)
@PreAuthorize("hasRole('LEADER')")
@RequiredArgsConstructor
public class StorageAdminController {

    private final StorageUsageService storageUsageService;

    @Operation(summary = "저장 용량 현황",
            description = """
                    사진첩 + 첨부·주보 + 월례회 문서가 차지하는 바이트를 합칩니다.

                    ⚠️ **R2에 실제 용량을 묻지 않습니다.** `ListObjects`는 Class A
                    연산이라, 화면을 열 때마다 부르면 세려던 비용을 세는 행위가
                    만들어냅니다. DB에 적어둔 `size_bytes` 합계를 씁니다.

                    `blockThreshold`(95%)에 닿으면 업로드가 `STORAGE_LIMIT`(409)로
                    막힙니다 — 한도(100%)에서 막으면 이미 과금이 시작된 뒤입니다.
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
    public ApiResponse<StorageUsage> storage() {
        return ApiResponse.of(storageUsageService.usage());
    }
}
