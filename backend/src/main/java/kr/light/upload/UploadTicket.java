package kr.light.upload;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 발급된 presigned PUT URL 한 쌍 (SPEC_API.md §6.5).
 *
 * <p>브라우저가 이 두 주소로 R2에 <b>직접</b> 올린다 — 파일이 우리 서버를
 * 통과하지 않는다.
 */
@Schema(description = "업로드 URL 한 쌍")
public record UploadTicket(

        @Schema(description = "요청에 실어 보낸 값 그대로", example = "f1")
        String clientId,

        @Schema(description = "재시도할 때 이 id로 다시 발급받는다 — 고아 객체를 막는다",
                example = "901")
        String photoId,

        String viewPutUrl,

        String thumbPutUrl,

        @Schema(description = "초", example = "900")
        long expiresIn
) {
}
