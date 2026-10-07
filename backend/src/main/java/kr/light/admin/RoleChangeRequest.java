package kr.light.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import kr.light.member.Role;

/**
 * 역할 변경 (SPEC_API.md §8.4).
 *
 * <p>세 역할 모두 유효하다 (PM 결정 2026-10-07 — 전도사 인수인계를 앱 안에서).
 * 마지막 전도사 강등만 서비스가 막는다.
 */
@Schema(name = "RoleChangeRequest", description = "역할 변경 요청")
public record RoleChangeRequest(

        @Schema(description = "MEMBER · LEADER · PASTOR", example = "LEADER",
                requiredMode = Schema.RequiredMode.REQUIRED,
                allowableValues = {"MEMBER", "LEADER", "PASTOR"})
        @NotNull(message = "역할을 선택해주세요.")
        Role role
) {
}
