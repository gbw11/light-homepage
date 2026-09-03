package kr.light.attendance;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.util.List;

/**
 * 회차 상세 (SPEC_API.md §13.3).
 *
 * <p><b>{@code entries}는 명단 전원이다</b> — 체크된 사람만이 아니다.
 * 체크 화면이 명단을 훑으며 상태를 찍는 방식이라, 아직 체크하지 않은 사람도
 * {@code status: null}로 함께 내려가야 한다.
 */
@Schema(name = "AttendanceSessionDetail", description = "회차 + 명단 전원의 출결")
public record SessionDetailResponse(

        @Schema(description = "회차 ID (문자열)", example = "\"2\"")
        String id,

        @Schema(example = "2026-08-24")
        LocalDate date,

        @Schema(example = "SUNDAY_SERVICE")
        AttendanceSessionType type,

        @Schema(example = "주일예배")
        String title,

        @Schema(description = "명단 전원. 마을 → 이름 순")
        List<EntryResponse> entries
) {
}
