package kr.light.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * 비밀번호 재설정 요청 (SPEC_API.md §2.9).
 *
 * <p>⚠️ <b>응답은 항상 204다.</b> 이 이메일이 가입돼 있는지 알려주지 않는다 —
 * 알려주면 계정 열거에 쓰인다.
 */
@Schema(name = "PasswordResetRequest", description = "재설정 메일 발송 요청")
public record PasswordResetRequest(

        @Schema(example = "user@example.com", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "이메일을 입력해주세요.")
        @Email(message = "이메일 형식이 올바르지 않습니다.")
        String email
) {
}
