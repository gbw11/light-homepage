package kr.light.sermon;

import java.time.Instant;

/**
 * 진행 중인 라이브 (SPEC_API.md §9.3).
 *
 * <p>⚠️ 방송 중이 아니면 이 값이 <b>없다</b>(=null). 빈 객체나
 * {@code live: false} 플래그를 쓰지 않는다 — FE의 화면 분기가 둘로 갈린다.
 */
public record LiveBroadcast(
        String videoId,
        String title,
        Instant startedAt,
        String watchUrl,
        String thumbnailUrl
) {
    public static LiveBroadcast of(String videoId, String title, Instant startedAt) {
        return new LiveBroadcast(videoId, title, startedAt,
                YoutubeUrls.watch(videoId), YoutubeUrls.thumbnail(videoId));
    }
}
