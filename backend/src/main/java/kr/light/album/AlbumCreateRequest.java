package kr.light.album;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;

/** 앨범 생성 (SPEC_API.md §6.2) */
public record AlbumCreateRequest(

        @Schema(example = "2026 여름수련회")
        @NotBlank(message = "앨범 이름을 입력해 주세요.")
        @Size(max = 200, message = "앨범 이름은 200자를 넘을 수 없습니다.")
        String title,

        @Schema(description = "행사일. 비워둘 수 있다", example = "2026-08-01")
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        LocalDate eventDate
) {
}
