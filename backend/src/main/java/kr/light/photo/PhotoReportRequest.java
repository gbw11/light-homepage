package kr.light.photo;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 사진 신고·삭제 요청 (SPEC_API.md §6.10) */
public record PhotoReportRequest(

        @Schema(description = "요청 내용", example = "본인 사진 삭제 요청합니다")
        @NotBlank(message = "요청 내용을 입력해주세요.")
        @Size(max = 1000, message = "요청 내용은 1000자를 넘을 수 없습니다.")
        String reason
) {
}
