package kr.light.common;

import org.springframework.http.HttpStatus;

/**
 * 에러 코드 — <b>FE가 분기에 쓰는 값</b>이므로 이 집합을 벗어나지 않는다.
 *
 * <p>합의된 7개는 {@link #UNAUTHORIZED} · {@link #FORBIDDEN} ·
 * {@link #PENDING_APPROVAL} · {@link #NOT_FOUND} · {@link #VALIDATION_ERROR} ·
 * {@link #STORAGE_LIMIT} · {@link #DUPLICATE} 이다 (SPEC_API.md §1.2).
 *
 * <p>⚠️ 여기에 값을 추가하는 것은 <b>비호환 계약 변경</b>이다. 절차는
 * INTEGRATION.md §5 — 사전 합의 + {@code [CONTRACT]} PR + 상대 승인.
 * "더 나은 이름"으로 조용히 바꾸는 것도 금지다.
 */
public enum ErrorCode {

    /** 로그인 필요 → FE는 로그인 화면으로 */
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."),

    /** 권한 부족 → FE는 접근 불가 안내 */
    FORBIDDEN(HttpStatus.FORBIDDEN, "권한이 없습니다."),

    /** 가입했으나 미승인 → FE는 어느 화면에 있든 /pending 으로 보낸다 */
    PENDING_APPROVAL(HttpStatus.FORBIDDEN, "가입 승인 대기 중입니다."),

    /**
     * 없음 <b>또는 권한이 없어 숨김</b>.
     *
     * <p>예산안처럼 존재 자체를 숨겨야 하는 리소스는 403이 아니라 이 코드로
     * 응답한다. 403을 주면 "그 글이 있다"는 사실이 새어나간다
     * (ARCHITECTURE.md §5.2).
     */
    NOT_FOUND(HttpStatus.NOT_FOUND, "찾을 수 없습니다."),

    /** 입력값 오류 — {@code field}에 필드명을 담아 FE가 해당 입력란에 표시한다 */
    VALIDATION_ERROR(HttpStatus.BAD_REQUEST, "입력값을 확인해주세요."),

    /** 저장 용량 초과 → 업로드 차단 + 안내. 비용 $0 제약을 지키는 장치 */
    STORAGE_LIMIT(HttpStatus.CONFLICT, "저장 용량이 부족합니다."),

    /** 중복 (이메일·주보 날짜 등) */
    DUPLICATE(HttpStatus.CONFLICT, "이미 존재합니다."),

    /**
     * 요청이 너무 잦음 — 새가족 폼의 동일 IP 5분 5회 제한 (SPEC_API.md §9.1).
     *
     * <p>⚠️ <b>합의된 7개 집합에 없는 코드다.</b> 명세는 "거부한다"고만 적고 어떤
     * 코드로 거부할지는 정하지 않았는데, 7개 중 의미가 맞는 것이 없다.
     * {@code FORBIDDEN}을 쓰면 "권한 없음"과 "너무 자주 보냄"이 한 코드가 되어
     * FE가 분기할 수 없다.
     *
     * <p>→ <b>프론트 담당자와 합의가 필요하다.</b> 합의되면 {@code [CONTRACT]} PR로
     * SPEC_API.md §1.2 표에 행을 추가한다. FE는 이 코드에 "잠시 후 다시
     * 시도해주세요"를 띄우면 된다.
     */
    RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "요청이 너무 잦습니다. 잠시 후 다시 시도해주세요."),

    /**
     * 예상하지 못한 서버 오류.
     *
     * <p>⚠️ <b>합의된 7개 집합에 없는 코드다.</b> 그런데 500에 쓸 코드가
     * 명세에 없고, 봉투 없이 Spring 기본 응답을 흘려보내면 FE의 공통 에러
     * 파서가 깨진다. 둘 다 나쁘지만 후자가 더 나쁘다고 판단해 임시로 둔다.
     *
     * <p>→ <b>프론트 담당자와 합의가 필요한 항목이다.</b> 합의되면
     * {@code [CONTRACT]} PR로 SPEC_API.md §1.2 표에 행을 추가한다.
     */
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "일시적인 오류가 발생했습니다.");

    private final HttpStatus status;
    private final String defaultMessage;

    ErrorCode(HttpStatus status, String defaultMessage) {
        this.status = status;
        this.defaultMessage = defaultMessage;
    }

    public HttpStatus status() {
        return status;
    }

    public String defaultMessage() {
        return defaultMessage;
    }
}
