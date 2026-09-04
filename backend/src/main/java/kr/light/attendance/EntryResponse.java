package kr.light.attendance;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 회차 상세의 한 사람 (SPEC_API.md §13.3).
 *
 * <p>⚠️ 전화번호·생년월일을 싣지 않는다. 출석 기록은 "누가 교회에 안 나왔는지"의
 * 기록이라 예산안과 같은 급의 민감 정보다 — 체크에 필요한 값만 담는다 (§13.0).
 */
@Schema(name = "AttendanceEntry", description = "명단 한 사람의 출결")
public record EntryResponse(

        @Schema(description = "명단 행 ID (문자열)", example = "\"5\"")
        String rosterId,

        @Schema(description = "명단의 이름 (동명이인 접미사 포함)", example = "김도연a")
        String name,

        /*
          ⚠️ null일 수 있다. member_roster.village는 nullable이다 — 교회 명단
          CSV에 마을 열이 없을 수 있어서다 (§8.1의 ❓ 미해결 항목).
          FE의 Village 타입은 현재 null을 허용하지 않으므로 알림이 필요하다.
        */
        @Schema(description = "마을. ⚠️ 명단에 마을 정보가 없으면 null이다",
                example = "1", nullable = true)
        String village,

        @Schema(description = "⚠️ null = 아직 체크하지 않음 (ABSENT와 다르다)",
                example = "PRESENT", nullable = true)
        AttendanceStatus status
) {
}
