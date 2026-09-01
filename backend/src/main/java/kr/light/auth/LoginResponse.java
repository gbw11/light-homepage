package kr.light.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import kr.light.member.Member;
import kr.light.member.Role;

/**
 * 로그인 결과 (SPEC_API.md §2.3).
 *
 * <p>토큰은 여기 없다 — 쿠키로 나간다. 응답 본문에 넣으면 JS가 읽을 수 있게 되어
 * httpOnly로 얻은 것이 사라진다.
 *
 * <p>⚠️ 연락처는 넣지 않는다. 로그인 응답은 화면 상단(이름·역할)을 그리는
 * 데 필요한 만큼만 준다. 전체 프로필은 {@code GET /api/auth/me}다.
 *
 * <p>~~{@code village} · {@code profileComplete}~~ 는 v1.3에서 제거됐다 —
 * 마을을 받지 않고, 프로필은 명단에서 다 가져오므로 항상 완성 상태다.
 */
@Schema(name = "LoginResult", description = "로그인 결과")
public record LoginResponse(

        @Schema(description = "회원 ID. 문자열이다.", example = "\"42\"")
        String id,

        @Schema(description = "명단의 이름 (동명이인 접미사 포함)", example = "김도연a")
        String name,

        @Schema(example = "MEMBER")
        Role role
) {
    static LoginResponse of(Member member) {
        return new LoginResponse(
                String.valueOf(member.getId()), member.getName(), member.getRole());
    }
}
