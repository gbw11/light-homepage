package kr.light.common;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 실패 응답 봉투 — {@code { "error": { "code": ..., "message": ..., "field": ... }}}.
 *
 * <p>{@code field}는 {@code VALIDATION_ERROR}에서만 값이 들어가고 나머지는
 * null이다. 필드를 생략하지 않고 null을 명시해 FE의 옵셔널 처리를 단순하게
 * 둔다 (SPEC_API.md §1.3).
 *
 * <p>{@code @Schema}는 Swagger UI에 이 형태를 그대로 싣기 위한 것이다. FE가
 * 계약서에서 실패 응답의 모양을 볼 수 있어야 한다 (INTEGRATION.md §3.3).
 */
@Schema(name = "ErrorResponse", description = "실패 응답 봉투")
public record ErrorResponse(Body error) {

    /**
     * ⚠️ 스키마 이름을 {@code ErrorBody}로 못박는다. 기본값이면 중첩 레코드
     * 이름 그대로 {@code Body}가 되는데, 계약서에서 너무 일반적인 이름이라
     * 나중에 다른 중첩 타입과 부딪친다.
     */
    @Schema(name = "ErrorBody", description = "에러 상세")
    public record Body(
            @Schema(description = "FE가 분기에 쓰는 값. SPEC_API.md §1.2의 집합을 벗어나지 않는다.",
                    example = "FORBIDDEN")
            String code,

            @Schema(description = "사용자에게 그대로 보여줘도 되는 문구", example = "권한이 없습니다.")
            String message,

            @Schema(description = "VALIDATION_ERROR에서만 값이 들어간다. 나머지는 null.",
                    example = "email", nullable = true)
            String field
    ) {}

    public static ErrorResponse of(ErrorCode code, String message, String field) {
        return new ErrorResponse(new Body(code.name(), message, field));
    }

    public static ErrorResponse of(ErrorCode code) {
        return of(code, code.defaultMessage(), null);
    }
}
