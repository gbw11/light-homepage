package kr.light.attendance;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;

/**
 * 회차 목록 한 줄 (SPEC_API.md §13.1).
 *
 * <p>세 집계가 함께 나가는 이유 — 목록 화면이 <b>"체크 4/15"</b> 진행 상태를
 * 회차마다 보여준다. 이 값이 없으면 화면이 회차마다 상세를 부르게 된다.
 */
@Schema(name = "AttendanceSessionSummary", description = "출석 회차 요약")
public record SessionSummaryResponse(

        @Schema(description = "회차 ID (문자열)", example = "\"2\"")
        String id,

        @Schema(description = "회차 날짜", example = "2026-08-24")
        LocalDate date,

        @Schema(example = "SUNDAY_SERVICE")
        AttendanceSessionType type,

        @Schema(example = "주일예배")
        String title,

        @Schema(description = "상태가 기록된 인원 (PRESENT든 ABSENT든)", example = "4")
        long checkedCount,

        @Schema(description = "PRESENT 인원", example = "3")
        long presentCount,

        @Schema(description = "active 명단 전체 인원", example = "15")
        long rosterCount
) {
}
