package kr.light.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 비밀번호 변경 (SPEC_API.md §2.11).
 *
 * <p>현재 비밀번호를 함께 받는다. 로그인해 있다는 것만으로는 부족하다 —
 * 자리를 비운 사이 남이 브라우저를 만지면 비밀번호를 바꿔 계정을 통째로
 * 가져갈 수 있다.
 */
@Schema(name = "ChangePasswordRequest", description = "비밀번호 변경 요청")
public record ChangePasswordRequest(

        @Schema(description = "현재 비밀번호")
        @NotBlank(message = "현재 비밀번호를 입력해주세요.")
        String currentPassword,

        // 상한은 여기서 보지 않는다 — BCrypt의 한계는 72바이트라
        // @Size로는 한글을 정확히 막을 수 없다 (kr.light.common.Passwords)
        @Schema(description = "새 비밀번호. 8자 이상")
        @NotBlank(message = "새 비밀번호를 입력해주세요.")
        @Size(min = 8, message = "비밀번호는 8자 이상이어야 합니다.")
        String newPassword
) {
}
