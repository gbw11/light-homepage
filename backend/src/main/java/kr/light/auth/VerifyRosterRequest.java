package kr.light.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 명단 확인 요청 — 가입 1단계 (SPEC_API.md §2.1).
 *
 * <p>⚠️ <b>형식 검증만 한다.</b> 값이 명단과 맞는지는 여기서 보지 않는다 —
 * 필드별로 틀렸다고 알려주면 "이 이름·생년월일은 명단에 있다"가 새어나가
 * 명단을 캐낼 수 있게 된다. 대조 실패는 전부 같은 401 하나다.
 */
@Schema(name = "VerifyRosterRequest", description = "명단 확인 요청 (가입 1단계)")
public record VerifyRosterRequest(

        @Schema(description = "명단의 이름. 동명이인은 접미사를 포함한다.", example = "김도연a")
        @NotBlank(message = "이름을 입력해주세요.")
        @Size(max = 50, message = "이름이 너무 깁니다.")
        String name,

        @Schema(description = "생년월일 (YYYY-MM-DD)", example = "2001-03-14")
        @NotBlank(message = "생년월일을 입력해주세요.")
        @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}",
                message = "생년월일은 YYYY-MM-DD 형식입니다.")
        String birthDate,

        @Schema(description = "전화번호. 표기는 자유롭게 — 서버가 숫자만 남겨 비교한다.",
                example = "010-1234-5678")
        @NotBlank(message = "전화번호를 입력해주세요.")
        @Size(max = 30, message = "전화번호가 너무 깁니다.")
        String phone
) {
}
