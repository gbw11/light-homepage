package kr.light.album;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;

/** 앨범 목록 항목 (SPEC_API.md §6.1) */
@Schema(description = "앨범 목록 항목")
public record AlbumSummaryResponse(

        @Schema(example = "5")
        String id,

        @Schema(example = "2026 여름수련회")
        String title,

        @Schema(description = "행사일. 없을 수 있다", example = "2026-08-01")
        LocalDate eventDate,

        @Schema(description = "커밋된 사진 수", example = "243")
        long photoCount,

        @Schema(description = "대표 사진의 썸네일 presigned URL(10분). ⚠️ 사진이 없는 앨범은 null",
                nullable = true)
        String coverThumbUrl
) {
}
