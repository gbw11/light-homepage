package kr.light.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/** 로그인 (SPEC_API.md §2.3) */
@Schema(name = "LoginRequest", description = "로그인 요청")
public record LoginRequest(

        @Schema(description = "가입 때 정한 아이디. 이메일이 아니다.",
                example = "doyeon01", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "아이디를 입력해주세요.")
        String loginId,

        @Schema(example = "비밀번호12!", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "비밀번호를 입력해주세요.")
        String password
) {
}
