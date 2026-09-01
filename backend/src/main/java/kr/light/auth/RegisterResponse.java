package kr.light.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import kr.light.member.Member;
import kr.light.member.Role;

/**
 * 계정 생성 결과 (SPEC_API.md §2.2).
 *
 * <p>⚠️ <b>세션 쿠키가 함께 나가지 않는다</b> (2026-09-01 BE 확정). FE는 가입
 * 완료 화면에서 로그인으로 유도한다 — 방금 정한 비밀번호를 한 번 써 보게 하는
 * 편이 "가입은 됐는데 비밀번호를 잘못 기억한" 상태를 그 자리에서 잡아낸다.
 */
@Schema(name = "RegisterResponse", description = "계정 생성 결과 — 즉시 회원")
public record RegisterResponse(

        @Schema(description = "회원 ID (문자열)", example = "\"42\"")
        String id,

        @Schema(description = "명단의 이름 (접미사 포함)", example = "김도연a")
        String name,

        @Schema(description = "역할 — 승인 절차가 없어 항상 MEMBER다", example = "MEMBER")
        Role role
) {
    public static RegisterResponse of(Member member) {
        return new RegisterResponse(
                String.valueOf(member.getId()), member.getName(), member.getRole());
    }
}
