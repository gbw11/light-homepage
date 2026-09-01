package kr.light.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 계정 삭제 + 명단 재개방 (SPEC_API.md §8.2).
 *
 * <p>사유를 필수로 받는다. 회원 행은 삭제되므로 <b>감사로그의 사유가 유일한
 * 기록</b>이다 — 비워두면 나중에 "왜 지웠지"를 알 방법이 없다. 이 절차가
 * 쓰이는 상황(선점 복구)은 본인 확인을 거쳤다는 근거가 특히 중요하다.
 */
@Schema(name = "MemberDeleteRequest", description = "계정 삭제 요청")
public record DeleteMemberRequest(

        @Schema(description = "삭제 사유. 감사로그에 남는 유일한 기록이다.",
                example = "본인 확인 — 선점 계정 삭제", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "삭제 사유를 입력해주세요.")
        @Size(max = 500, message = "사유가 너무 깁니다.")
        String reason
) {
}
