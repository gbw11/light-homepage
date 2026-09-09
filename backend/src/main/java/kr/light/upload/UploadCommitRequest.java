package kr.light.upload;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/** 업로드 확정 (SPEC_API.md §6.6) — <b>20장 배치</b>. 200회 호출은 낭비다 */
public record UploadCommitRequest(

        @Schema(description = "발급 때 받은 photoId들. 한 번에 최대 50개")
        @NotEmpty(message = "확정할 사진이 없습니다.")
        @Size(max = 50, message = "한 번에 50장까지 확정할 수 있습니다.")
        List<String> photoIds
) {
}
