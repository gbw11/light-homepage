package kr.light.album;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;

/** 용량 회수 대상 후보 (SPEC_API.md §6.11) */
@Schema(description = "정리 대상 앨범")
public record AlbumPurgeCandidate(

        @Schema(example = "5")
        String id,

        @Schema(example = "2023 여름수련회")
        String title,

        @Schema(description = "행사일. 이 값으로 오래된 순을 정한다", example = "2023-08-01")
        LocalDate eventDate,

        @Schema(description = "커밋된 사진 수", example = "243")
        long photoCount,

        @Schema(description = "이 앨범을 지우면 회수되는 바이트", example = "322961408")
        long sizeBytes
) {
}
