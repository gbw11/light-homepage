package kr.light.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import kr.light.member.Member;
import kr.light.member.Role;

import java.time.Instant;

/**
 * 내 정보 (SPEC_API.md §2.5).
 *
 * <p>본인만 보는 것이므로 이메일·연락처를 포함한다. 다른 회원의 정보를 이 형태로
 * 내보내는 엔드포인트를 만들지 말 것 — 명단이 곧 개인정보다.
 */
@Schema(name = "Me", description = "내 정보")
public record MeResponse(

        @Schema(description = "회원 ID. 문자열이다.", example = "\"42\"")
        String id,

        @Schema(example = "김도연")
        String name,

        @Schema(description = "카카오 전용 계정은 null이다.", example = "user@example.com", nullable = true)
        String email,

        @Schema(example = "010-1234-5678", nullable = true)
        String phone,

        @Schema(example = "3", nullable = true)
        String village,

        @Schema(example = "MEMBER")
        Role role,

        @Schema(example = "true")
        boolean profileComplete,

        @Schema(description = "승인 시각. 미승인이면 null.",
                example = "2026-08-20T02:11:00Z", nullable = true)
        Instant approvedAt
) {

    static MeResponse of(Member member) {
        return new MeResponse(
                String.valueOf(member.getId()),
                member.getName(),
                member.getEmail(),
                member.getPhone(),
                member.getVillage(),
                member.getRole(),
                member.isProfileComplete(),
                member.getApprovedAt());
    }
}
