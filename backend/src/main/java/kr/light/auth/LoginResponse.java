package kr.light.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import kr.light.member.Member;
import kr.light.member.Role;

/**
 * 로그인 결과 (SPEC_API.md §2.2).
 *
 * <p>토큰은 여기 없다 — 쿠키로 나간다. 응답 본문에 넣으면 JS가 읽을 수 있게 되어
 * httpOnly로 얻은 것이 사라진다.
 *
 * <p>⚠️ 이메일·연락처는 넣지 않는다. 로그인 응답은 화면 상단(이름·역할)을 그리는
 * 데 필요한 만큼만 준다. 전체 프로필은 {@code GET /api/auth/me}다.
 */
@Schema(name = "LoginResult", description = "로그인 결과")
public record LoginResponse(

        @Schema(description = "회원 ID. 문자열이다.", example = "\"42\"")
        String id,

        @Schema(example = "김도연")
        String name,

        @Schema(description = "\"1\"~\"9\" 또는 \"newcomer\". 카카오 가입 직후엔 null.",
                example = "3", nullable = true)
        String village,

        @Schema(example = "MEMBER")
        Role role,

        @Schema(description = "실명·연락처·마을이 모두 채워졌는가. false면 FE가 /signup/complete로 보낸다.",
                example = "true")
        boolean profileComplete
) {

    static LoginResponse of(Member member) {
        return new LoginResponse(
                String.valueOf(member.getId()),
                member.getName(),
                member.getVillage(),
                member.getRole(),
                member.isProfileComplete());
    }
}
