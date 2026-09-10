package kr.light.photo;

import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import kr.light.auth.AuthPrincipal;
import kr.light.common.ApiException;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;

/**
 * 사진 개별 처리 (SPEC_API.md §6.7 · §6.9).
 *
 * <p>열람은 회원(M)부터, 삭제는 임원(L)이다 (§10).
 */
@Tag(name = "사진첩", description = "사진 다운로드 · 삭제")
@RestController
@RequestMapping(value = "/api/photos", produces = MediaType.APPLICATION_JSON_VALUE)
@PreAuthorize("hasRole('MEMBER')")
@RequiredArgsConstructor
public class PhotoController {

    private final PhotoService photoService;
    private final MemberRepository memberRepository;

    @Operation(summary = "사진 내려받기",
            description = """
                    **302 리다이렉트**로 presigned URL을 줍니다. 파일을 서버가
                    중계하지 않습니다 — 전송량과 메모리를 쓰지 않기 위해서입니다.

                    2560px 원본을 줍니다 (썸네일이 아닙니다).

                    ⚠️ 리다이렉트 대상 주소에는 **인증이 없습니다.** 권한 판단은
                    이 요청에서 끝나고, 그 뒤 10분간은 주소를 가진 사람이 받을 수
                    있습니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "302", description = "presigned URL로 리다이렉트"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "404", ref = "#/components/responses/NOT_FOUND")
    })
    @GetMapping("/{id}/download")
    public ResponseEntity<Void> download(@PathVariable Long id) {
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(photoService.downloadUrl(id)))
                .build();
    }

    @Operation(summary = "사진 신고·삭제 요청",
            description = """
                    초상권 대응입니다 — "제 사진을 내려주세요"를 임원에게 전달합니다.

                    ★ **사진이 지워지지 않습니다.** 요청을 접수할 뿐이고, 실제
                    삭제는 임원이 판단합니다. 신고만으로 지워지면 아무나 남의
                    사진을 내릴 수 있습니다.

                    ⚠️ **2026-09-04에 권한이 `G`(익명 허용)에서 `M`으로 바뀌었습니다.**
                    사진첩 열람이 `M`이라 익명은 사진 `{id}`를 알아낼 경로가
                    없었습니다 — 열어둬도 쓸 수 없는 창구였습니다.
                    비회원의 초상권 요청은 교회 연락처 등 사이트 밖 경로로 받습니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "204", description = "접수 완료"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400", ref = "#/components/responses/VALIDATION_ERROR"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "401", ref = "#/components/responses/UNAUTHORIZED"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "404", ref = "#/components/responses/NOT_FOUND")
    })
    @PostMapping("/{id}/report")
    public ResponseEntity<Void> report(
            @PathVariable Long id,
            @Valid @RequestBody PhotoReportRequest request,
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        photoService.report(id, request.reason(), actor(principal));
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "사진 삭제",
            description = "⚠️ **R2 객체까지 지웁니다.** 남기면 용량이 조용히 샙니다.")
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
        photoService.delete(id);
        return ResponseEntity.noContent().build();
    }

    /** 신고한 사람. 감사 로그의 행위자로 남는다 */
    private Member actor(AuthPrincipal principal) {
        return memberRepository.findById(principal.memberId())
                .orElseThrow(ApiException::unauthorized);
    }
}
