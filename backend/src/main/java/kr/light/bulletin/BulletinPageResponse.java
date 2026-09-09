package kr.light.bulletin;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 주보 한 페이지 (SPEC_API.md §5.1).
 *
 * <p>⚠️ <b>사진첩과 로딩 전략이 반대다.</b> 주보는 글자가 작아 썸네일이 아니라
 * 큰 이미지(장변 2048px)를 바로 준다.
 */
@Schema(description = "주보 한 페이지")
public record BulletinPageResponse(

        @Schema(description = "1부터. 업로드한 순서다", example = "1")
        int pageNo,

        @Schema(description = "presigned URL (10분). ⚠️ 이 주소 자체에는 인증이 없다",
                example = "https://....r2.cloudflarestorage.com/...?X-Amz-...")
        String url,

        @Schema(description = "가로 픽셀. 뷰어가 받기 전에 자리를 잡는 데 쓴다", example = "1448")
        Integer width,

        @Schema(description = "세로 픽셀", example = "2048")
        Integer height
) {
}
