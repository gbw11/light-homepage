package kr.light.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 새 비밀번호 설정 (SPEC_API.md §2.10).
 *
 * <p>토큰은 1회용이고 만료된다 (NFR-SEC-08).
 */
@Schema(name = "PasswordResetConfirmRequest", description = "새 비밀번호 설정")
public record PasswordResetConfirmRequest(

        @Schema(description = "메일로 받은 1회용 토큰", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "토큰이 필요합니다.")
        String token,

        @Schema(description = "8자 이상", example = "새비밀번호1234!",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "비밀번호를 입력해주세요.")
        @Size(min = 8, max = 72, message = "비밀번호는 8자 이상입니다.")
        String password
) {
}
