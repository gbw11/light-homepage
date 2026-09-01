package kr.light.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import kr.light.member.Member;
import kr.light.member.Role;

/**
 * 내 정보 (SPEC_API.md §2.6).
 *
 * <p>본인만 보는 것이므로 연락처를 포함한다. 다른 회원의 정보를 이 형태로
 * 내보내는 엔드포인트를 만들지 말 것 — 명단이 곧 개인정보다.
 *
 * <p>~~{@code email} · {@code village} · {@code profileComplete} ·
 * {@code approvedAt}~~ 은 v1.3에서 제거됐다 (§2.6).
 */
@Schema(name = "Me", description = "내 정보")
public record MeResponse(

        @Schema(description = "회원 ID. 문자열이다.", example = "\"42\"")
        String id,

        @Schema(description = "명단의 이름 (동명이인 접미사 포함)", example = "김도연a")
        String name,

        @Schema(description = "카카오로 가입했으면 null이다.", example = "doyeon01", nullable = true)
        String loginId,

        @Schema(example = "010-1234-5678", nullable = true)
        String phone,

        @Schema(example = "MEMBER")
        Role role
) {
    static MeResponse of(Member member) {
        return new MeResponse(
                String.valueOf(member.getId()),
                member.getName(),
                member.getLoginId(),
                member.getPhone(),
                member.getRole());
    }
}
