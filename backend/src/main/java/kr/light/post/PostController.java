package kr.light.post;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import kr.light.common.ApiResponse;
import kr.light.common.PageResponse;
import kr.light.member.Role;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.MediaType;

/**
 * 게시물 조회 (SPEC_API.md §3).
 *
 * <p><b>⚠️ 이 컨트롤러는 권한을 직접 판단하지 않는다.</b> 받은 category를 그대로
 * {@link PostQueryService}에 넘기고, 판단은 전부 그 단일 관문이 한다
 * (ARCHITECTURE.md §5.2). 여기에 분기를 추가하면 방어선이 둘로 갈라진다.
 *
 * <p><b>M1 범위는 공개 공지다</b>(SPEC_API.md §11). 다른 분류도 경로는 같지만
 * 인증 수단이 아직 없어 실제로는 401·403으로 막힌다. 쓰기(§3.4·§3.5)는 M2다.
 */
@Tag(name = "게시물", description = "공지 · 회의록 · 예산안. 열람 권한은 category로 갈린다.")
@RestController
@RequestMapping(value = "/api/posts", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class PostController {

    private final PostQueryService postQueryService;

    @Operation(summary = "게시물 목록",
            description = """
                    분류별 목록입니다. 정렬은 상단고정 우선 → 게시일 최신순이며 바꿀 수 없습니다.
                    임시저장(`publish:false`) 글은 포함되지 않습니다.

                    `size`는 최대 100이고, 넘겨 보내면 100으로 잘라서 응답합니다.
                    """)
    @ApiResponses({
            // ⚠️ 200을 명시하지 않으면 springdoc이 성공 응답을 아예 빼버린다.
            //    그러면 계약서에 PostSummary 스키마가 실리지 않아 FE가 볼 것이 없다.
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200", description = "조회 성공"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400", ref = "#/components/responses/VALIDATION_ERROR"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", ref = "#/components/responses/FORBIDDEN")
    })
    @GetMapping
    public ApiResponse<PageResponse<PostSummaryResponse>> list(
            @Parameter(description = "필수. 이 값으로 열람 권한이 갈린다.", required = true)
            @RequestParam PostCategory category,

            @Parameter(description = "0부터. 기본 0")
            @RequestParam(required = false) Integer page,

            @Parameter(description = "기본 20, 최대 100")
            @RequestParam(required = false) Integer size
    ) {
        return ApiResponse.of(postQueryService.list(
                category,
                currentRole(),
                PostQueryService.normalizePage(page),
                PostQueryService.normalizeSize(size)));
    }

    @Operation(summary = "게시물 상세",
            description = """
                    id 또는 slug로 조회합니다. 공개 공지는 slug로, 나머지는 id로 접근합니다.

                    ⚠️ 없는 글과 권한이 없는 글은 **똑같이 404**로 응답합니다.
                    응답이 갈리면 그 차이만으로 글의 존재를 알아낼 수 있기 때문입니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200", description = "조회 성공"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", ref = "#/components/responses/PENDING_APPROVAL"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "404", ref = "#/components/responses/NOT_FOUND")
    })
    @GetMapping("/{idOrSlug}")
    public ApiResponse<PostDetailResponse> get(
            @Parameter(description = "게시물 ID 또는 slug", example = "summer-retreat-2026")
            @PathVariable String idOrSlug
    ) {
        return ApiResponse.of(postQueryService.get(idOrSlug, currentRole()));
    }

    /**
     * 요청자의 역할. 비로그인이면 null.
     *
     * <p><b>M1에는 인증 수단이 없어 항상 null이다.</b> JWT 필터가 붙는 M2부터
     * 실제 값이 들어온다 — 권한 이름 규약({@code ROLE_LEADER})만 맞으면 이 코드는
     * 그대로 동작한다.
     *
     * <p>여러 컨트롤러가 같은 코드를 반복하게 되면 그때
     * {@code HandlerMethodArgumentResolver}로 옮긴다. 지금 옮기면 쓰는 곳이
     * 하나뿐이라 오히려 흐름이 흩어진다.
     */
    private Role currentRole() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) {
            return null;
        }
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(name -> name.startsWith("ROLE_"))
                .map(name -> name.substring("ROLE_".length()))
                .flatMap(name -> java.util.Arrays.stream(Role.values())
                        .filter(role -> role.name().equals(name)))
                .findFirst()
                .orElse(null);
    }
}
