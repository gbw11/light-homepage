package kr.light.meeting;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

/** 열람 기간 수정 (SPEC_API.md §7.5) — 연장·조기 종료 */
public record MeetingWindowRequest(

        @Schema(example = "2026-08-24T11:00:00Z")
        @NotNull(message = "열람 시작 시각을 입력해 주세요.")
        Instant viewableFrom,

        @Schema(example = "2026-08-26T14:59:00Z")
        @NotNull(message = "열람 종료 시각을 입력해 주세요.")
        Instant viewableUntil
) {
}
