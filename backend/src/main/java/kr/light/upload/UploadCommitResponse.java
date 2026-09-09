package kr.light.upload;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/**
 * 확정 결과 (SPEC_API.md §6.6).
 *
 * <p>⚠️ <b>일부 실패를 400으로 만들지 않는다.</b> 20장 중 한 장이 실패했다고
 * 전체를 되돌리면 성공한 19장까지 다시 올려야 한다. 실패한 것만 골라
 * 돌려주고, FE는 그것만 재시도한다.
 */
@Schema(description = "업로드 확정 결과")
public record UploadCommitResponse(

        @Schema(description = "확정된 photoId")
        List<String> committed,

        @Schema(description = "실패한 것 — 이것만 재시도하면 된다")
        List<Failure> failed
) {

    @Schema(description = "확정 실패 한 건")
    public record Failure(
            String photoId,

            @Schema(description = "OBJECT_NOT_FOUND(R2에 없음) · NOT_FOUND(그런 사진 없음) · ALREADY_COMMITTED",
                    example = "OBJECT_NOT_FOUND")
            String reason
    ) {
    }
}
