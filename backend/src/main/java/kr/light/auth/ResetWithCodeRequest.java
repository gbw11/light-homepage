package kr.light.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 리셋 코드로 비밀번호 재설정 (SPEC_API.md §2.9).
 *
 * <p>코드 형식은 여기서 검사하지 않는다. 형식이 틀렸다고 400을 주면
 * "형식은 맞는데 코드가 틀렸다"와 구분되어, 코드를 맞혀보는 쪽에 단서가 된다.
 * 표기 흔들림(소문자·하이픈 없음)은 {@link ResetCodes#normalize}가 흡수한다.
 */
@Schema(name = "ResetPasswordWithCodeRequest", description = "리셋 코드로 비밀번호 재설정")
public record ResetWithCodeRequest(

        @Schema(description = "가입 때 정한 아이디", example = "doyeon01")
        @NotBlank(message = "아이디를 입력해주세요.")
        String loginId,

        @Schema(description = "전도사에게 받은 리셋 코드", example = "8H2K-9QX1")
        @NotBlank(message = "리셋 코드를 입력해주세요.")
        String resetCode,

        @Schema(description = "새 비밀번호. 8자 이상", example = "새비밀번호1234!")
        @NotBlank(message = "새 비밀번호를 입력해주세요.")
        @Size(min = 8, message = "비밀번호는 8자 이상이어야 합니다.")
        String password
) {
}
