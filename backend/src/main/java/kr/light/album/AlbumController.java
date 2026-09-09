package kr.light.album;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import kr.light.auth.AuthPrincipal;
import kr.light.common.ApiException;
import kr.light.common.ApiResponse;
import kr.light.common.CursorResponse;
import kr.light.common.PageResponse;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import kr.light.photo.PhotoResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 사진첩 — 앨범 (SPEC_API.md §6.1~§6.4).
 *
 * <p><b>⚠️ 열람은 회원(M)부터다.</b> §6 본문에는 아직 {@code G}로 적혀 있지만
 * <b>§10 인가 매트릭스(테스트 기준)가 401</b>이고, 2026-08-31 "열람 M 복귀"
 * 결정이 사진첩을 명시한다. 본문 표기가 그때 갱신되지 않은 것이다.
 *
 * <p>클래스 단위로 {@code hasRole('MEMBER')}를 걸어 기본을 막힘으로 둔다.
 * 쓰기는 메서드 단위 {@code hasRole('LEADER')}가 덮어쓴다.
 */
@Tag(name = "사진첩", description = "앨범 목록 · 사진 조회")
@RestController
@RequestMapping(value = "/api/albums", produces = MediaType.APPLICATION_JSON_VALUE)
@PreAuthorize("hasRole('MEMBER')")
@RequiredArgsConstructor
public class AlbumController {

    private final AlbumService albumService;
    private final MemberRepository memberRepository;

    @Operation(summary = "앨범 목록",
            description = """
                    행사일이 최근인 것부터입니다.

                    `coverThumbUrl`은 대표 사진의 **썸네일**(640px) presigned
                    URL(10분)입니다. ⚠️ 사진이 한 장도 없는 앨범은 `null`입니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200", description = "조회 성공"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED")
    })
    @GetMapping
    public ApiResponse<PageResponse<AlbumSummaryResponse>> list(
            @Parameter(description = "0부터. 기본 0")
            @RequestParam(required = false) Integer page,

            @Parameter(description = "기본 20, 최대 100")
            @RequestParam(required = false) Integer size
    ) {
        return ApiResponse.of(albumService.list(
                AlbumService.normalizePage(page), AlbumService.normalizeSize(size)));
    }

    @Operation(summary = "앨범 생성")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "201", description = "생성 완료"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400", ref = "#/components/responses/VALIDATION_ERROR"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", ref = "#/components/responses/FORBIDDEN")
    })
    @PreAuthorize("hasRole('LEADER')")
    @PostMapping
    public ResponseEntity<ApiResponse<Map<String, String>>> create(
            @Valid @RequestBody AlbumCreateRequest request,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        String id = albumService.create(request, actor(principal));
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.of(Map.of("id", id)));
    }

    @Operation(summary = "앨범 삭제",
            description = """
                    ⚠️ **사진 행과 R2 객체를 모두 지웁니다** (§6.3).

                    커밋되지 않은 `PENDING` 사진의 객체도 함께 지웁니다 —
                    브라우저가 업로드는 끝냈는데 확정을 못 부른 경우가 있어,
                    남기면 아무도 가리키지 않는 고아 객체가 됩니다.
                    """)
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
        albumService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "앨범의 사진 — 커서 페이징",
            description = """
                    ★ **그리드는 `thumbUrl`(640px)만 씁니다.** 200장 열람 시
                    전송량이 약 16MB입니다. `viewUrl`(2560px)은 확대·다운로드용입니다.

                    `nextCursor`를 그대로 다음 요청의 `cursor`에 넣으세요.
                    `hasNext`가 false면 `nextCursor`는 `null`입니다.

                    ⚠️ **커서 값을 해석하거나 만들지 마세요.** 불투명한 문자열입니다.

                    `status = COMMITTED`인 사진만 나옵니다 — 아직 안 올라온
                    사진이 섞이면 그리드에 깨진 이미지가 뜹니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200", description = "조회 성공"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400", ref = "#/components/responses/VALIDATION_ERROR"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "404", ref = "#/components/responses/NOT_FOUND")
    })
    @GetMapping("/{id}/photos")
    public ApiResponse<CursorResponse<PhotoResponse>> photos(
            @PathVariable Long id,

            @Parameter(description = "이전 응답의 nextCursor. 처음이면 생략")
            @RequestParam(required = false) String cursor,

            @Parameter(description = "기본 40, 최대 100")
            @RequestParam(required = false) Integer size
    ) {
        return ApiResponse.of(albumService.photos(id, cursor, size));
    }

    private Member actor(AuthPrincipal principal) {
        return memberRepository.findById(principal.memberId())
                .orElseThrow(ApiException::unauthorized);
    }
}
