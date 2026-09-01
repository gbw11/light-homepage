package kr.light.auth;

/**
 * 카카오 쪽에서 실패했다.
 *
 * <p>{@code ApiException}이 아니다 — 콜백(§2.8)은 JSON이 아니라 <b>리다이렉트</b>로
 * 답해야 한다. 에러 봉투를 내보내면 사용자는 브라우저에 JSON이 찍힌 화면을 본다.
 * 그래서 이 예외는 서비스가 잡아 "가입 화면으로 되돌리기"로 바꾼다.
 */
public class KakaoException extends RuntimeException {

    public KakaoException(String message) {
        super(message);
    }

    public KakaoException(String message, Throwable cause) {
        super(message, cause);
    }
}
