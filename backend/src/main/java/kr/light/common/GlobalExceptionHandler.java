package kr.light.common;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * 모든 예외를 계약된 한 가지 형태로 변환한다 (SPEC_API.md §1.1).
 *
 * <p>이 클래스가 있어야 FE가 에러 처리를 한 곳에서 만들 수 있다. 여기를
 * 통과하지 않는 예외가 생기면 그 엔드포인트만 다른 모양으로 응답하게 되고,
 * FE의 공통 파서가 깨진다.
 *
 * <p><b>⚠️ 여기로 오지 않는 구간:</b> Spring Security 필터 체인에서 발생하는
 * 401·403은 {@code ExceptionTranslationFilter}가 처리하므로 이 어드바이스에
 * 도달하지 않는다. 그쪽은 {@code SecurityConfig}의
 * {@code AuthenticationEntryPoint}·{@code AccessDeniedHandler}가 같은 봉투를
 * 만든다. 아래 두 핸들러는 메서드 보안(@PreAuthorize)에서 던져져 컨트롤러 호출
 * 안에서 잡히는 경우를 위한 것이다 — <b>양쪽 형태가 어긋나지 않게 함께 고칠 것.</b>
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /** 우리가 의도적으로 던진 예외 */
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApi(ApiException e) {
        return ResponseEntity
                .status(e.code().status())
                .body(ErrorResponse.of(e.code(), e.getMessage(), e.field()));
    }

    // ── 입력값 검증 ────────────────────────────────────────────

    /** @Valid @RequestBody 위반 — field에 첫 위반 필드명을 담는다 */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleBodyValidation(MethodArgumentNotValidException e) {
        FieldError first = e.getBindingResult().getFieldErrors().stream().findFirst().orElse(null);
        String field = first != null ? first.getField() : null;
        String message = first != null && first.getDefaultMessage() != null
                ? first.getDefaultMessage()
                : ErrorCode.VALIDATION_ERROR.defaultMessage();
        return validationError(message, field);
    }

    /** @Validated 파라미터 위반 */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleParamValidation(ConstraintViolationException e) {
        ConstraintViolation<?> first = e.getConstraintViolations().stream().findFirst().orElse(null);
        String field = null;
        String message = ErrorCode.VALIDATION_ERROR.defaultMessage();
        if (first != null) {
            String path = first.getPropertyPath().toString();
            // "method.argName" 형태에서 마지막 조각만 필드명으로 쓴다
            field = path.contains(".") ? path.substring(path.lastIndexOf('.') + 1) : path;
            message = first.getMessage();
        }
        return validationError(message, field);
    }

    /** 필수 쿼리 파라미터 누락 — 예: category 없이 /api/posts 호출 */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleMissingParam(MissingServletRequestParameterException e) {
        return validationError("필수 항목이 누락되었습니다.", e.getParameterName());
    }

    /** 타입 불일치 — 예: category=SECRET 처럼 열거형에 없는 값 */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        return validationError("값의 형식이 올바르지 않습니다.", e.getName());
    }

    /** 본문이 JSON이 아니거나 파싱 불가 */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadableBody(HttpMessageNotReadableException e) {
        return validationError("요청 본문을 읽을 수 없습니다.", null);
    }

    // ── 권한 ──────────────────────────────────────────────────

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ErrorResponse> handleAuthentication(AuthenticationException e) {
        return ResponseEntity
                .status(ErrorCode.UNAUTHORIZED.status())
                .body(ErrorResponse.of(ErrorCode.UNAUTHORIZED));
    }

    /**
     * 역할 부족 — 주로 {@code @PreAuthorize}가 던진다.
     *
     * <p><b>⚠️ 이 경로가 필터의 {@code AccessDeniedHandler}보다 먼저 잡는다.</b>
     * {@code @PreAuthorize}는 컨트롤러 호출 중에 터지므로 어드바이스가 가로챈다.
     * 즉 <b>같은 "권한 부족"이 두 경로로 나간다</b> — 두 곳이 다른 코드를
     * 내보내면 FE는 같은 상황에서 다른 화면을 띄운다. 실제로 어긋난 적이 있어,
     * <b>한쪽을 바꾸면 반드시 {@code SecurityConfig}의 핸들러도 같이 본다.</b>
     *
     * <p>⚠️ 여기서 403을 내보낸다는 것은 "리소스는 있으나 권한이 없다"를
     * 알려주는 것이다. 존재 자체를 숨겨야 하는 리소스(예산안 등)는 서비스
     * 계층에서 {@link ApiException#notFound()}를 던져 404로 만들어야 한다.
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException e) {
        return ResponseEntity.status(ErrorCode.FORBIDDEN.status())
                .body(ErrorResponse.of(ErrorCode.FORBIDDEN));
    }

    // ── 그 외 ─────────────────────────────────────────────────

    /** 매핑되지 않은 경로 */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoResource(NoResourceFoundException e) {
        return ResponseEntity
                .status(ErrorCode.NOT_FOUND.status())
                .body(ErrorResponse.of(ErrorCode.NOT_FOUND));
    }

    /** unique 제약 위반 등 */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrity(DataIntegrityViolationException e) {
        // 어떤 제약이 걸렸는지는 로그로만 남긴다. 응답에 DB 구조를 노출하지 않는다.
        log.warn("데이터 정합성 위반", e);
        return ResponseEntity
                .status(ErrorCode.DUPLICATE.status())
                .body(ErrorResponse.of(ErrorCode.DUPLICATE));
    }

    /**
     * 예상하지 못한 오류.
     *
     * <p>⚠️ {@code INTERNAL_ERROR}는 합의된 7개 집합 밖의 코드다.
     * {@link ErrorCode#INTERNAL_ERROR} 주석 참고 — 프론트 담당자와 합의가 필요하다.
     *
     * <p>예외 메시지를 응답에 담지 않는다. 스택트레이스나 SQL이 그대로 노출될 수 있다.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception e) {
        log.error("처리하지 못한 예외", e);
        return ResponseEntity
                .status(ErrorCode.INTERNAL_ERROR.status())
                .body(ErrorResponse.of(ErrorCode.INTERNAL_ERROR));
    }

    private ResponseEntity<ErrorResponse> validationError(String message, String field) {
        return ResponseEntity
                .status(ErrorCode.VALIDATION_ERROR.status())
                .body(ErrorResponse.of(ErrorCode.VALIDATION_ERROR, message, field));
    }
}
