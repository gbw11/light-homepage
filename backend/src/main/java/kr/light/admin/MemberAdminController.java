package kr.light.admin;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import kr.light.auth.AuthPrincipal;
import kr.light.common.ApiException;
import kr.light.common.ApiResponse;
import kr.light.common.PageResponse;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

/**
 * 회원 관리 — <b>전도사 전용</b> (SPEC_API.md §8.1~§8.4).
 *
 * <p><b>⚠️ 클래스 전체에 {@code @PreAuthorize("hasRole('PASTOR')")}를 건다.</b>
 * 메서드마다 달면 새 메서드를 추가할 때 빠뜨릴 수 있고, 이 컨트롤러는
 * 빠뜨리는 순간 <b>회원 명단 전체와 역할 부여가 열린다</b>. 예외를 두어야 하는
 * 메서드가 생기면 그 메서드에만 다시 선언한다.
 *
 * <p>역할 계층상 PASTOR만 통과한다 — LEADER는 상위가 아니므로 막힌다
 * (인가 매트릭스: `GET /admin/members` LEADER **403**).
 */
@Tag(name = "회원 관리", description = "승인 · 거절 · 역할 부여. 전도사 전용.")
@RestController
@RequestMapping(value = "/api/admin/members", produces = MediaType.APPLICATION_JSON_VALUE)
@PreAuthorize("hasRole('PASTOR')")
@RequiredArgsConstructor
public class MemberAdminController {

    private final MemberAdminService memberAdminService;
    private final MemberRepository memberRepository;

    @Operation(summary = "회원 목록",
            description = """
                    `status=PENDING`이면 승인 대기만, `ALL`이면 전체입니다. `q`는 이름 부분 검색이고
                    대소문자를 구분하지 않습니다. 정렬은 가입일 최신순입니다.

                    ⚠️ 응답에 이메일·연락처가 들어갑니다. 명단 자체가 개인정보입니다.
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
    public ApiResponse<PageResponse<MemberSummaryResponse>> list(
            @Parameter(description = "PENDING | ALL. 기본 PENDING")
            @RequestParam(required = false, defaultValue = "PENDING") String status,

            @Parameter(description = "이름 부분 검색")
            @RequestParam(required = false) String q,

            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size
    ) {
        return ApiResponse.of(memberAdminService.list(
                !"ALL".equalsIgnoreCase(status),
                q,
                MemberAdminService.normalizePage(page),
                MemberAdminService.normalizeSize(size)));
    }

    @Operation(summary = "가입 승인",
            description = """
                    `role`을 `MEMBER`로 올리고 승인자·승인시각을 기록합니다. 감사로그가 남고
                    본인에게 안내 메일이 갑니다(발송부는 미구현).

                    이미 승인된 회원에게 다시 호출하면 `VALIDATION_ERROR`입니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "204", description = "승인 완료"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400", ref = "#/components/responses/VALIDATION_ERROR"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", ref = "#/components/responses/FORBIDDEN"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "404", ref = "#/components/responses/NOT_FOUND")
    })
    @PostMapping("/{id}/approve")
    public ResponseEntity<Void> approve(@PathVariable Long id,
                                        @AuthenticationPrincipal AuthPrincipal principal) {
        memberAdminService.approve(id, actor(principal), Instant.now());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "가입 거절",
            description = """
                    ⚠️ **회원 행을 삭제합니다.** 스키마에 "거절됨" 상태가 없고, 거절된 사람의
                    개인정보를 보관할 이유가 없기 때문입니다.

                    **거절 사유가 유일한 기록으로 감사로그에 남습니다.**

                    승인 대기 상태가 아닌 회원은 거절할 수 없습니다 — 활동 중인 회원을 지우는 것은
                    탈퇴(§2.13)의 몫입니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "204", description = "거절 완료 — 회원 행 삭제됨"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400", ref = "#/components/responses/VALIDATION_ERROR"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", ref = "#/components/responses/FORBIDDEN"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "404", ref = "#/components/responses/NOT_FOUND")
    })
    @PostMapping("/{id}/reject")
    public ResponseEntity<Void> reject(@PathVariable Long id,
                                       @Valid @RequestBody RejectRequest request,
                                       @AuthenticationPrincipal AuthPrincipal principal) {
        memberAdminService.reject(id, actor(principal), request.reason());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "역할 변경",
            description = """
                    `MEMBER ↔ LEADER`만 가능합니다 (FR-ADM-04). 전도사 임명은 API로 열지 않습니다.

                    ⚠️ **마지막 전도사는 강등할 수 없습니다** — 아무도 회원을 승인할 수 없게 되기
                    때문입니다 (§5.4 자기잠금 방지). 시도하면 `VALIDATION_ERROR`입니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "204", description = "변경 완료"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400", ref = "#/components/responses/VALIDATION_ERROR"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "403", ref = "#/components/responses/FORBIDDEN"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "404", ref = "#/components/responses/NOT_FOUND")
    })
    @PatchMapping("/{id}/role")
    public ResponseEntity<Void> changeRole(@PathVariable Long id,
                                           @Valid @RequestBody RoleChangeRequest request,
                                           @AuthenticationPrincipal AuthPrincipal principal) {
        memberAdminService.changeRole(id, request.role(), actor(principal));
        return ResponseEntity.noContent().build();
    }

    /**
     * 감사로그에 남길 행위자.
     *
     * <p>{@link AuthPrincipal}은 id와 역할만 들고 있으므로 실제 회원을 읽어온다.
     * 여기서 DB를 한 번 더 읽는 비용을 감수하는 이유는, <b>감사로그가 누가
     * 했는지를 남기지 못하면 존재 이유가 없기</b> 때문이다. 관리 동작은 드물어
     * 이 비용이 문제되지 않는다.
     *
     * <p>토큰은 유효한데 회원이 없다면 탈퇴 후 토큰이 남은 경우다 → 401.
     */
    private Member actor(AuthPrincipal principal) {
        return memberRepository.findById(principal.memberId())
                .orElseThrow(ApiException::unauthorized);
    }
}
