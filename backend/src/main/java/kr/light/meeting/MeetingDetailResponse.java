package kr.light.meeting;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.time.LocalDate;

/** 월례회 상세 (SPEC_API.md §7.2) */
@Schema(description = "월례회 자료 상세")
public record MeetingDetailResponse(

        String id,
        String title,
        LocalDate meetingDate,
        int pageCount,
        MeetingDocStatus status,
        Instant viewableUntil,

        @Schema(description = "종료까지 남은 초. 이미 끝났으면 0", example = "183540")
        long remainingSeconds,

        @Schema(description = "이 사람이 지금 페이지를 열 수 있는가", example = "true")
        boolean canView,

        @Schema(description = """
                볼 수 없는 이유. 볼 수 있으면 null.

                `PERIOD_CLOSED` — 열람 기간이 끝났습니다
                `PERIOD_NOT_STARTED` — 아직 시작 전입니다
                """,
                nullable = true, example = "PERIOD_CLOSED")
        String viewReason
) {
}
