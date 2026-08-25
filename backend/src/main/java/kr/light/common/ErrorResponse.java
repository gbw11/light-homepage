package kr.light.common;

/**
 * 실패 응답 봉투 — {@code { "error": { "code": ..., "message": ..., "field": ... }}}.
 *
 * <p>{@code field}는 {@code VALIDATION_ERROR}에서만 값이 들어가고 나머지는
 * null이다. 필드를 생략하지 않고 null을 명시해 FE의 옵셔널 처리를 단순하게
 * 둔다 (SPEC_API.md §1.3).
 */
public record ErrorResponse(Body error) {

    public record Body(String code, String message, String field) {}

    public static ErrorResponse of(ErrorCode code, String message, String field) {
        return new ErrorResponse(new Body(code.name(), message, field));
    }

    public static ErrorResponse of(ErrorCode code) {
        return of(code, code.defaultMessage(), null);
    }
}
