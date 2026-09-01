package kr.light.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import kr.light.auth.PasswordResetService;

import java.time.Instant;

/**
 * 리셋 코드 발급 결과 (SPEC_API.md §8.4).
 *
 * <p>⚠️ <b>평문 코드가 담긴 유일한 응답이다.</b> 서버는 해시만 갖고 있어
 * 다시 알아낼 수 없다 — 전도사가 이 화면에서 코드를 옮겨 적어 본인에게
 * 전한다. 놓치면 새로 발급해야 하고, 그러면 이 코드는 무효가 된다.
 */
@Schema(name = "ResetCodeIssued", description = "리셋 코드 발급 결과")
public record ResetCodeResponse(

        @Schema(description = "★ 평문 코드. 전도사가 구두·문자로 전달한다", example = "8H2K-9QX1")
        String resetCode,

        @Schema(description = "만료 시각 (발급 30분 뒤)", example = "2026-08-31T12:30:00Z")
        Instant expiresAt
) {
    static ResetCodeResponse of(PasswordResetService.IssuedCode issued) {
        return new ResetCodeResponse(issued.code(), issued.expiresAt());
    }
}
