package kr.light.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 이메일 회원가입 (SPEC_API.md §2.1).
 *
 * <p>가입은 곧바로 회원이 되는 것이 아니라 {@code role=PENDING} 상태로 대기한다.
 * 전도사가 승인해야 회원 API가 열린다 (ARCHITECTURE.md §7.2).
 */
@Schema(name = "SignupRequest", description = "이메일 회원가입 요청")
public record SignupRequest(

        @Schema(description = "실명. 승인 대조에 쓰이므로 닉네임이 아니다.",
                example = "김도연", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "이름을 입력해주세요.")
        @Size(min = 2, max = 50, message = "이름은 2~50자입니다.")
        String name,

        @Schema(example = "user@example.com", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "이메일을 입력해주세요.")
        @Email(message = "이메일 형식이 올바르지 않습니다.")
        @Size(max = 255, message = "이메일이 너무 깁니다.")
        String email,

        @Schema(description = "8자 이상", example = "비밀번호1234!",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "비밀번호를 입력해주세요.")
        @Size(min = 8, max = 72, message = "비밀번호는 8자 이상입니다.")
        String password,

        @Schema(example = "010-1234-5678", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "연락처를 입력해주세요.")
        @Pattern(regexp = "^01[0-9]-[0-9]{3,4}-[0-9]{4}$",
                message = "010-0000-0000 형식으로 입력해주세요.")
        String phone,

        @Schema(description = "\"1\"~\"9\" 또는 \"newcomer\"", example = "3",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "소속 마을을 선택해주세요.")
        @Pattern(regexp = "^([1-9]|newcomer)$", message = "1~9마을 또는 새가족마을이어야 합니다.")
        String village,

        @Schema(description = "개인정보 수집 동의. **true가 아니면 거부한다.**",
                example = "true", requiredMode = Schema.RequiredMode.REQUIRED)
        Boolean agreed
) {

    boolean agreedToPrivacyPolicy() {
        return Boolean.TRUE.equals(agreed);
    }
}
