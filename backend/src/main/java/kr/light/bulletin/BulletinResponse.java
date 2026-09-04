package kr.light.bulletin;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.util.List;

/** 주보 상세 (SPEC_API.md §5.1 · §5.3) */
@Schema(description = "주보 상세")
public record BulletinResponse(

        @Schema(description = "ID는 문자열이다 (§1.3)", example = "12")
        String id,

        @Schema(description = "주일 날짜", example = "2026-08-24")
        LocalDate serviceDate,

        @Schema(description = "페이지 순서대로")
        List<BulletinPageResponse> pages
) {
}
