package kr.light.meeting;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/**
 * 열람 기록 응답 (SPEC_API.md §7.7).
 *
 * <p>{@code PageResponse}를 쓰지 않는 이유는 {@code totalViewers}가 더 붙기
 * 때문이다 — 계약이 그렇게 정하고 있다.
 */
@Schema(description = "열람 기록 (§7.7)")
public record MeetingViewsResponse(

        @Schema(description = "서로 다른 열람자 수. 페이지 수와 무관한 전체 값", example = "34")
        long totalViewers,

        List<MeetingViewerResponse> items,
        int page,
        int size,
        boolean hasNext
) {
}
