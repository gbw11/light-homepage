package kr.light.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 가입 거절 (SPEC_API.md §8.3).
 *
 * <p>사유를 필수로 받는다. 회원 행은 삭제되므로 <b>감사로그의 사유가 유일한
 * 기록</b>이다 — 비워두면 나중에 "왜 거절했지"를 알 방법이 없다.
 */
@Schema(name = "MemberRejectRequest", description = "가입 거절 요청")
public record RejectRequest(

        @Schema(description = "거절 사유. 감사로그에 남는 유일한 기록이다.",
                example = "청년교회 소속 확인 불가", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "거절 사유를 입력해주세요.")
        @Size(max = 500, message = "사유가 너무 깁니다.")
        String reason
) {
}
