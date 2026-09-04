package kr.light.attendance;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * 출결 한 건 (SPEC_API.md §13.4).
 *
 * <p>⚠️ <b>요청 본문은 이것의 배열이고 envelope가 없다</b> — 명세가 그렇게
 * 정하고 있다. 컨트롤러가 {@code List<EntryUpsertRequest>}를 직접 받는다.
 */
@Schema(name = "AttendanceEntryInput", description = "출결 한 건")
public record EntryUpsertRequest(

        @Schema(description = "명단 행 ID", example = "\"5\"")
        @NotBlank(message = "대상을 지정해주세요.")
        String rosterId,

        @Schema(example = "PRESENT")
        @NotNull(message = "출결 상태를 선택해주세요.")
        AttendanceStatus status
) {
}
