package kr.light.common;

/**
 * 계약에 맞는 에러 응답으로 변환되는 예외.
 *
 * <p>{@link GlobalExceptionHandler}가 이것을 잡아 {@link ErrorResponse} 형태로
 * 내보낸다. 서비스 계층에서는 아래 정적 팩터리를 쓴다.
 *
 * <p><b>권한 없는 리소스에는 {@link #notFound()}를 쓴다.</b> {@link #forbidden()}을
 * 주면 "그 글이 존재한다"는 사실이 새어나간다. 어느 쪽을 쓸지는
 * SPEC_API.md §10 인가 매트릭스가 엔드포인트별로 정해두고 있다.
 */
public class ApiException extends RuntimeException {

    private final ErrorCode code;
    private final String field;

    public ApiException(ErrorCode code, String message, String field) {
        super(message);
        this.code = code;
        this.field = field;
    }

    public ErrorCode code() {
        return code;
    }

    public String field() {
        return field;
    }

    // ── 정적 팩터리 ────────────────────────────────────────────

    public static ApiException unauthorized() {
        return new ApiException(ErrorCode.UNAUTHORIZED, ErrorCode.UNAUTHORIZED.defaultMessage(), null);
    }

    /**
     * 문구를 지정하는 401.
     *
     * <p>명단 대조(SPEC_API.md §2.1)처럼 <b>여러 이유를 한 문구로 모아야</b> 하는
     * 곳에서 쓴다. 이유마다 문구가 다르면 문구 자체가 답을 알려준다.
     */
    public static ApiException unauthorized(String message) {
        return new ApiException(ErrorCode.UNAUTHORIZED, message, null);
    }

    public static ApiException forbidden() {
        return new ApiException(ErrorCode.FORBIDDEN, ErrorCode.FORBIDDEN.defaultMessage(), null);
    }

    /** 없거나, 있어도 권한이 없어 숨기는 경우 */
    public static ApiException notFound() {
        return new ApiException(ErrorCode.NOT_FOUND, ErrorCode.NOT_FOUND.defaultMessage(), null);
    }

    public static ApiException validation(String field, String message) {
        return new ApiException(ErrorCode.VALIDATION_ERROR, message, field);
    }

    public static ApiException storageLimit(String message) {
        return new ApiException(ErrorCode.STORAGE_LIMIT, message, null);
    }

    /** 동일 IP의 과도한 제출 (SPEC_API.md §9.1) */
    public static ApiException rateLimited() {
        return new ApiException(ErrorCode.RATE_LIMITED, ErrorCode.RATE_LIMITED.defaultMessage(), null);
    }

    public static ApiException duplicate(String field, String message) {
        return new ApiException(ErrorCode.DUPLICATE, message, field);
    }
}
