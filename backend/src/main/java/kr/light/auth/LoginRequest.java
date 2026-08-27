package kr.light.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/** 로그인 (SPEC_API.md §2.2) */
@Schema(name = "LoginRequest", description = "로그인 요청")
public record LoginRequest(

        @Schema(example = "user@example.com", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "이메일을 입력해주세요.")
        String email,

        @Schema(example = "비밀번호1234!", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "비밀번호를 입력해주세요.")
        String password
) {
}
