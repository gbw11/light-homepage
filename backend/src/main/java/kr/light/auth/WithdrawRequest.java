package kr.light.auth;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 회원 탈퇴 (SPEC_API.md §2.12).
 *
 * <p>⚠️ {@code password}가 <b>필수가 아니다.</b> 카카오로 가입한 계정에는
 * 비밀번호가 없기 때문이다 — 필수로 두면 그 사람들은 탈퇴할 수 없다.
 * 비밀번호가 있는 계정은 서버가 요구하고, 없는 계정은 로그인 세션 자체가
 * 본인 확인이 된다 (2026-09-01 BE 확정).
 */
@Schema(name = "WithdrawRequest", description = "회원 탈퇴 요청")
public record WithdrawRequest(

        @Schema(description = "현재 비밀번호. 카카오로 가입했다면 보내지 않는다.",
                nullable = true)
        String password
) {
}
