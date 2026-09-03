package kr.light.sermon;

/**
 * YouTube 호출이 실패했다.
 *
 * <p>{@code ApiException}이 아니다 — 이 실패는 <b>사용자에게 보여줄 오류가
 * 아니다.</b> 설교 목록이 비거나 라이브가 없는 것으로 보이면 화면은 정상
 * 동작한다 (§9.2 "빈 목록" · §9.3 "null"). 그래서 서비스가 잡아서
 * 그렇게 바꾼다.
 *
 * <p>대신 <b>로그에는 남긴다</b> — 쿼터 소진·키 만료는 우리가 알아야 한다.
 */
public class YoutubeException extends RuntimeException {

    public YoutubeException(String message) {
        super(message);
    }

    public YoutubeException(String message, Throwable cause) {
        super(message, cause);
    }
}
