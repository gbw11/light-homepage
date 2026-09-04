package kr.light.newcomer;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import kr.light.common.ApiResponse;
import kr.light.common.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 새가족 신청 목록 (SPEC_API.md §8.6).
 *
 * <p>권한 {@code L}(임원) 이상. 회원 관리(§8.1~§8.4)가 {@code P} 전용인 것과
 * 다르다 — 새가족에게 연락하는 것은 전도사만의 일이 아니다.
 *
 * <p>⚠️ <b>응답에 이름과 전화번호가 그대로 나간다.</b> 연락해야 하는 값이라
 * 가릴 수 없다. 그래서 이 경로는 로그인·권한이 전부 걸려 있고, 원본은
 * 보유기간 1년 뒤 삭제된다.
 */
@Tag(name = "관리", description = "새가족 신청 목록")
@RestController
@RequestMapping(value = "/api/admin/newcomers", produces = MediaType.APPLICATION_JSON_VALUE)
@PreAuthorize("hasRole('LEADER')")
@RequiredArgsConstructor
public class NewcomerAdminController {

    private final NewcomerAdminService newcomerAdminService;

    @Operation(summary = "새가족 신청 목록",
            description = """
                    최근 신청이 위입니다.

                    ⚠️ **개인정보입니다.** 이름·전화번호가 그대로 나갑니다 —
                    연락해야 하는 값이라 가릴 수 없습니다. 화면에 띄운 채로
                    자리를 비우지 마세요.

                    ⚠️ **보유기간 1년**입니다. 지난 신청은 서버가 자동으로
                    삭제하므로, 계속 보관해야 하는 내용은 따로 옮겨 두세요.

                    `gender`·`ageGroup`·`referrer`·`message`는 선택 항목이라
                    `null`일 수 있습니다.
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
    public ApiResponse<PageResponse<NewcomerRecordResponse>> list(
            @Parameter(description = "0부터. 기본 0")
            @RequestParam(required = false) Integer page,

            @Parameter(description = "기본 20, 최대 100")
            @RequestParam(required = false) Integer size
    ) {
        return ApiResponse.of(newcomerAdminService.list(
                NewcomerAdminService.normalizePage(page),
                NewcomerAdminService.normalizeSize(size)));
    }
}
