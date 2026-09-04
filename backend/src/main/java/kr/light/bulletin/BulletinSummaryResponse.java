package kr.light.bulletin;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;

/** 지난 주보 목록 항목 (SPEC_API.md §5.2) */
@Schema(description = "주보 목록 항목")
public record BulletinSummaryResponse(

        @Schema(example = "12")
        String id,

        @Schema(example = "2026-08-24")
        LocalDate serviceDate,

        @Schema(description = "페이지 수", example = "2")
        int pageCount,

        @Schema(description = """
                목록에 보여줄 이미지의 presigned URL (10분).

                ⚠️ **별도 썸네일이 아니라 1쪽 원본(장변 2048px)이다.** FE가
                2048px WebP만 올리고 서버는 이미지를 재가공하지 않는다 —
                WebP 디코딩을 512MB 인스턴스에서 하지 않기 위해서다.
                화면에서 크기를 줄여 쓰고, 목록이 길면 지연 로딩할 것.
                """,
                example = "https://....r2.cloudflarestorage.com/...?X-Amz-...")
        String thumbUrl
) {
}
