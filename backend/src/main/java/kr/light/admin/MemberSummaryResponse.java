package kr.light.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import kr.light.member.Member;
import kr.light.member.Role;

import java.time.Instant;

/**
 * 관리 화면의 회원 한 줄 (SPEC_API.md §8.1).
 *
 * <p>⚠️ <b>이 형태는 전도사만 본다</b>(인가 매트릭스 `GET /admin/members` = T).
 * 이메일·연락처가 들어 있어 명단 자체가 개인정보다. 다른 화면에 이 DTO를
 * 재사용하지 말 것.
 */
@Schema(name = "AdminMemberSummary", description = "회원 목록 항목 (전도사 전용)")
public record MemberSummaryResponse(

        @Schema(description = "회원 ID. 문자열이다.", example = "\"51\"")
        String id,

        @Schema(example = "이도연")
        String name,

        @Schema(description = "카카오 전용 계정은 null이다.", example = "lee@example.com", nullable = true)
        String email,

        @Schema(example = "010-1234-5678", nullable = true)
        String phone,

        @Schema(example = "5", nullable = true)
        String village,

        @Schema(example = "PENDING")
        Role role,

        @Schema(example = "true")
        boolean profileComplete,

        @Schema(example = "2026-08-19T09:00:00Z")
        Instant createdAt,

        @Schema(description = "승인 시각. 미승인이면 null.", nullable = true)
        Instant approvedAt
) {

    static MemberSummaryResponse of(Member member) {
        return new MemberSummaryResponse(
                String.valueOf(member.getId()),
                member.getName(),
                member.getEmail(),
                member.getPhone(),
                member.getVillage(),
                member.getRole(),
                member.isProfileComplete(),
                member.getCreatedAt(),
                member.getApprovedAt());
    }
}
