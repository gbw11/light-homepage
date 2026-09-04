package kr.light.meeting;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.time.LocalDate;

/** 월례회 목록 항목 (SPEC_API.md §7.1) */
@Schema(description = "월례회 자료 목록 항목")
public record MeetingSummaryResponse(

        @Schema(example = "3")
        String id,

        @Schema(example = "2026년 8월 월례회")
        String title,

        @Schema(example = "2026-08-24")
        LocalDate meetingDate,

        @Schema(example = "10")
        int pageCount,

        Instant viewableFrom,

        Instant viewableUntil,

        @Schema(description = """
                SCHEDULED(시작 전) · OPEN(열람 가능) · CLOSED(종료).

                ⚠️ 저장된 값이 아니라 **현재 시각으로 계산**합니다.
                종료된 자료도 목록에는 남습니다 — 존재는 알리되 내용은 막습니다.
                """)
        MeetingDocStatus status
) {
}
