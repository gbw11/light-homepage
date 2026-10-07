package kr.light.post;

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
 * 게시물 — 임원 작업용 조회 (SPEC_API.md §3.6 · §3.7, 2026-10-07).
 *
 * <p><b>왜 생겼나</b> — 공개 조회({@link PostController})는 임시저장 글을 목록과
 * 상세에서 모두 뺀다. 그래서 임시저장한 글을 <b>다시 열 길이 없었다</b>
 * (수정 화면이 공개 상세를 불러 404). 게시된 글을 수정 화면에서 [임시저장]으로
 * 내리면 그 글은 어디서도 찾을 수 없게 됐다 (사용자 흐름 점검 2026-10-07 🔴-2).
 *
 * <p><b>왜 {@code /api/posts}가 아니라 {@code /api/admin/posts}인가</b> —
 * {@code GET /api/posts/**}는 공개 공지 때문에 필터에서 익명에게 열려 있고,
 * {@code /{idOrSlug}}가 {@code /drafts}라는 slug와 부딪힐 수 있다. 관리 경로에
 * 두면 필터 단계에서 로그인이 강제되고 경로 충돌도 없다.
 *
 * <p>클래스 전체가 {@code LEADER} 이상이다 — 쓰기(§3.4·§3.5)와 같은 권한이다.
 * 임시저장 글은 쓰는 사람이 이어 쓰기 위해 보는 것이므로 쓸 수 있는 사람만 본다.
 */
@Tag(name = "게시물 (임원)", description = "임시저장 글 목록 · 수정 화면용 상세. 임원 이상.")
@RestController
@RequestMapping(value = "/api/admin/posts", produces = MediaType.APPLICATION_JSON_VALUE)
@PreAuthorize("hasRole('LEADER')")
@RequiredArgsConstructor
public class PostAdminController {

    private final PostQueryService postQueryService;

    @Operation(summary = "임시저장 글 목록",
            description = """
                    `publish:false`로 저장한 글을 분류와 무관하게 모읍니다. 최근에 저장한 글이 위로 옵니다.
                    `publishedAt`은 항상 null입니다. 작성자가 아닌 임원도 볼 수 있습니다 — 다른 임원이
                    이어서 쓸 수 있기 때문입니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200", description = "조회 성공"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", ref = "#/components/responses/FORBIDDEN")
    })
    @GetMapping("/drafts")
    public ApiResponse<PageResponse<PostSummaryResponse>> drafts(
            @AuthenticationPrincipal AuthPrincipal principal,

            @Parameter(description = "0부터. 기본 0")
            @RequestParam(required = false) Integer page,

            @Parameter(description = "기본 20, 최대 100")
            @RequestParam(required = false) Integer size
    ) {
        return ApiResponse.of(postQueryService.drafts(
                principal.role(),
                PostQueryService.normalizePage(page),
                PostQueryService.normalizeSize(size)));
    }

    @Operation(summary = "게시물 상세 (수정 화면용)",
            description = """
                    `GET /api/posts/{idOrSlug}`와 같은 응답이지만 **임시저장 글도 돌려줍니다.**
                    수정 화면은 이 경로로 글을 불러옵니다. id로만 찾습니다(slug 아님).
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200", description = "조회 성공"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", ref = "#/components/responses/FORBIDDEN"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "404", ref = "#/components/responses/NOT_FOUND")
    })
    @GetMapping("/{id}")
    public ApiResponse<PostDetailResponse> getForEdit(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Parameter(description = "게시물 ID", example = "18")
            @PathVariable Long id
    ) {
        return ApiResponse.of(postQueryService.getForEdit(id, principal.role()));
    }
}
