package kr.light.sermon;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * YouTube 연동 설정 — {@code app.youtube.*} (SPEC_API.md §9.2 · §9.3).
 *
 * <p><b>⚠️ API 키를 클라이언트에 실을 수 없어 BE가 프록시한다.</b>
 * {@code NEXT_PUBLIC_}으로 넘기면 번들에 그대로 박히고(NFR-SEC-22), 유출되면
 * 남이 우리 쿼터를 쓴다. 그래서 브라우저는 YouTube를 직접 부르지 않는다.
 *
 * @param apiKey     Google Cloud의 API 키. {@code application-local.yml}(gitignore)나
 *                   운영 환경변수로 준다
 * @param channelId  청년교회 채널 id. 공개 정보다
 * @param playlistId 설교만 담은 재생목록 id. <b>비어 있으면</b> 채널 업로드
 *                   전체에서 제목이 날짜로 시작하는 것만 골라낸다
 *                   ({@link SermonTitles}) — PM 확인 대기 중인 항목이다
 */
@ConfigurationProperties(prefix = "app.youtube")
public record YoutubeProperties(String apiKey, String channelId, String playlistId) {

    /** 키가 없으면 YouTube를 부르지 않는다 (개발 중 흔한 상태) */
    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank()
                && channelId != null && !channelId.isBlank();
    }

    public boolean hasPlaylist() {
        return playlistId != null && !playlistId.isBlank();
    }

    /**
     * 목록을 읽을 재생목록 id.
     *
     * <p>재생목록이 지정되지 않으면 <b>채널의 업로드 재생목록</b>을 쓴다.
     * 그 id는 채널 id의 {@code UC} 접두사를 {@code UU}로 바꾼 값이다 —
     * YouTube가 보장하는 규칙이라 {@code channels.list}를 한 번 더 부르지
     * 않아도 된다 (쿼터 1 unit 절약).
     */
    public String sourcePlaylistId() {
        if (hasPlaylist()) {
            return playlistId;
        }
        return "UU" + channelId.substring(2);
    }
}
