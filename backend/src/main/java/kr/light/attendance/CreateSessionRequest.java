package kr.light.attendance;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/** 회차 생성 (SPEC_API.md §13.2) */
@Schema(name = "AttendanceSessionInput", description = "회차 생성 요청")
public record CreateSessionRequest(

        @Schema(description = "회차 날짜 (YYYY-MM-DD)", example = "2026-08-30")
        @NotNull(message = "날짜를 입력해주세요.")
        LocalDate date,

        @Schema(example = "SUNDAY_SERVICE")
        @NotNull(message = "회차 종류를 선택해주세요.")
        AttendanceSessionType type,

        @Schema(example = "주일예배")
        @NotBlank(message = "회차 이름을 입력해주세요.")
        @Size(max = 100, message = "회차 이름이 너무 깁니다.")
        String title
) {
}
