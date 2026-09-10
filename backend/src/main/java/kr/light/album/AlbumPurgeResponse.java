package kr.light.album;

import io.swagger.v3.oas.annotations.media.Schema;

/** 정리 결과 (SPEC_API.md §6.11) */
@Schema(description = "정리 결과")
public record AlbumPurgeResponse(

        @Schema(description = "지운 앨범 수", example = "2")
        int deletedAlbums,

        @Schema(description = "지운 사진 수 (PENDING 포함)", example = "312")
        int deletedPhotos,

        @Schema(description = "회수된 바이트. 커밋된 사진의 합계다", example = "414187520")
        long freedBytes
) {
}
