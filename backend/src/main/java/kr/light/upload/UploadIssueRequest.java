package kr.light.upload;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

/** 업로드 URL 발급 요청 (SPEC_API.md §6.5) */
public record UploadIssueRequest(

        @Schema(example = "5")
        @NotBlank(message = "앨범을 선택해 주세요.")
        String albumId,

        @Schema(description = "한 번에 최대 50장. 200장은 배치로 나눠 발급받는다")
        @NotEmpty(message = "올릴 파일이 없습니다.")
        @Size(max = 50, message = "한 번에 50장까지 발급받을 수 있습니다.")
        @Valid
        List<File> files
) {

    /**
     * 파일 하나의 메타.
     *
     * <p>⚠️ <b>리사이즈 후 값이다.</b> 서버가 이 값으로 용량 한도를 검사하므로
     * (§6.5 {@code STORAGE_LIMIT}) 촬영 원본 크기를 보내면 멀쩡한 업로드가 막힌다.
     */
    public record File(

            @Schema(description = "브라우저가 붙이는 임시 식별자. 응답의 photoId와 짝짓는 데만 쓴다",
                    example = "f1")
            @NotBlank
            String clientId,

            @Schema(description = "2560px WebP 크기", example = "1250000")
            @Positive(message = "파일 크기가 올바르지 않습니다.")
            long sizeBytes,

            @Schema(description = "640px WebP 크기", example = "82000")
            @Positive(message = "썸네일 크기가 올바르지 않습니다.")
            long thumbSizeBytes,

            @Schema(example = "2560")
            @Positive
            Integer width,

            @Schema(example = "1707")
            @Positive
            Integer height,

            @Schema(description = "EXIF 촬영 시각. 없으면 null", nullable = true)
            Instant takenAt
    ) {
        /** 이 한 장이 R2에서 차지할 바이트 (view + thumb) */
        public long totalBytes() {
            return sizeBytes + thumbSizeBytes;
        }
    }
}
