package kr.light.meeting;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

/**
 * 열람 기록 한 줄 (SPEC_API.md §7.7).
 *
 * <p>⚠️ <b>유출 시 워터마크와 대조하는 근거</b>다. 그래서 이름이 그대로 나간다 —
 * 가리면 대조가 안 된다. 이 경로가 임원(L) 전용인 이유다.
 */
@Schema(description = "열람 기록")
public record MeetingViewerResponse(

        @Schema(example = "김도연")
        String memberName,

        @Schema(description = "명단의 마을. 없을 수 있다", nullable = true, example = "3")
        String village,

        Instant lastViewedAt,

        @Schema(description = "가장 멀리 본 페이지", example = "10")
        int maxPageNo
) {
}
