package kr.light.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 계정 생성 요청 — 가입 2단계 (SPEC_API.md §2.2).
 *
 * <p>이름·전화번호를 받지 않는다. 1단계에서 대조한 명단 행에서 가져온다 —
 * 여기서 다시 받으면 대조한 값과 저장되는 값이 갈라질 수 있다.
 */
@Schema(name = "RegisterRequest", description = "계정 생성 요청 (가입 2단계)")
public record RegisterRequest(

        @Schema(description = "1단계에서 받은 1회용 토큰")
        @NotBlank(message = "명단 확인을 먼저 진행해주세요.")
        String registrationToken,

        @Schema(description = "로그인 아이디. 영문 소문자·숫자·밑줄 4~30자", example = "doyeon01")
        @NotBlank(message = "아이디를 입력해주세요.")
        @Pattern(regexp = "^[a-z0-9_]{4,30}$",
                message = "아이디는 영문 소문자·숫자·밑줄 4~30자입니다.")
        String loginId,

        // ⚠️ 상한은 여기서 보지 않는다. BCrypt의 한계는 문자 수가 아니라
        //    72바이트라, @Size로는 한글 비밀번호를 정확히 막을 수 없다
        //    (kr.light.common.Passwords 참고 — 서비스가 검사한다).
        @Schema(description = "비밀번호. 8자 이상", example = "비밀번호1234!")
        @NotBlank(message = "비밀번호를 입력해주세요.")
        @Size(min = 8, message = "비밀번호는 8자 이상이어야 합니다.")
        String password
) {
}
