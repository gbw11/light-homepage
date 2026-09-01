package kr.light.auth;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 명단 확인 결과 (SPEC_API.md §2.1).
 *
 * @param registrationToken 가입 2단계에 그대로 넘긴다. <b>1회용 · 5분</b>
 * @param name              명단의 이름. FE가 "OOO님 맞으신가요"에 쓴다
 * @param expiresIn         남은 초. FE가 만료 안내를 띄운다
 */
@Schema(name = "VerifyRosterResponse", description = "명단 확인 결과")
public record VerifyRosterResponse(

        @Schema(description = "가입 2단계에 넘길 1회용 토큰")
        String registrationToken,

        @Schema(description = "명단에 등록된 이름 (접미사 포함)", example = "김도연a")
        String name,

        @Schema(description = "토큰 유효 시간(초)", example = "300")
        long expiresIn
) {
}
