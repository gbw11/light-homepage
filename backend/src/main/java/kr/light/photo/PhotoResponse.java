package kr.light.photo;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

/**
 * 앨범 사진 한 장 (SPEC_API.md §6.4).
 *
 * <p>⚠️ <b>주보와 로딩 전략이 반대다.</b> 그리드는 {@code thumbUrl}(640px)만
 * 쓴다 — 200장 열람 시 전송량이 약 16MB다. {@code viewUrl}(2560px)은 확대·
 * 다운로드용이다.
 */
@Schema(description = "앨범 사진")
public record PhotoResponse(

        @Schema(example = "901")
        String id,

        @Schema(description = "640px. **그리드는 이것만 쓴다**")
        String thumbUrl,

        @Schema(description = "2560px. 확대·다운로드용")
        String viewUrl,

        @Schema(example = "2560")
        Integer width,

        @Schema(example = "1707")
        Integer height,

        @Schema(description = "EXIF 촬영 시각. 없으면 null", nullable = true)
        Instant takenAt
) {
}
