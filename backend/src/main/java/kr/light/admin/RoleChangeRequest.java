package kr.light.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import kr.light.member.Role;

/**
 * 역할 변경 (SPEC_API.md §8.4).
 *
 * <p>⚠️ {@code MEMBER}·{@code LEADER}만 유효하다 (FR-ADM-04). 그 밖의 값은
 * 서비스가 거부한다 — enum 자체를 좁히지 않는 이유는 {@code PENDING}·
 * {@code PASTOR}가 도메인에는 존재하기 때문이다.
 */
@Schema(name = "RoleChangeRequest", description = "역할 변경 요청")
public record RoleChangeRequest(

        @Schema(description = "MEMBER 또는 LEADER", example = "LEADER",
                requiredMode = Schema.RequiredMode.REQUIRED,
                allowableValues = {"MEMBER", "LEADER"})
        @NotNull(message = "역할을 선택해주세요.")
        Role role
) {
}
