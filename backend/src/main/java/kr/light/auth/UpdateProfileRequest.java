package kr.light.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 프로필 수정 (SPEC_API.md §2.10).
 *
 * <p>바꿀 수 있는 것은 연락처뿐이다. <b>이름은 바꿀 수 없다</b> — 명단에서 온
 * 값이고, 계정의 이름이 명단과 갈라지면 "계정 = 명단에서 확인된 사람"이라는
 * 전제가 무너진다. 명단의 이름이 틀렸다면 교회 명단을 고칠 일이다.
 */
@Schema(name = "UpdateProfileRequest", description = "프로필 수정 요청")
public record UpdateProfileRequest(

        @Schema(description = "연락처", example = "010-9999-8888")
        @NotBlank(message = "연락처를 입력해주세요.")
        @Size(max = 30, message = "연락처가 너무 깁니다.")
        String phone
) {
}
