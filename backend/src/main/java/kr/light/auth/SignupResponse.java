package kr.light.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import kr.light.member.Member;
import kr.light.member.Role;

/** 가입 결과 — {@code 201 { "data": { "id": "42", "role": "PENDING" } }} (SPEC_API.md §2.1) */
@Schema(name = "SignupResult", description = "가입 결과")
public record SignupResponse(

        @Schema(description = "회원 ID. 문자열이다.", example = "\"42\"")
        String id,

        @Schema(description = "가입 직후는 항상 PENDING이다.", example = "PENDING")
        Role role
) {

    static SignupResponse of(Member member) {
        return new SignupResponse(String.valueOf(member.getId()), member.getRole());
    }
}
