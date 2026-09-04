package kr.light.sermon;

import java.time.Instant;

/**
 * 설교 영상 한 편 (SPEC_API.md §9.2).
 *
 * <p>YouTube가 준 값을 그대로 옮긴다 — 우리가 저장하지 않는다.
 */
public record SermonVideo(
        String id,
        String title,
        Instant publishedAt,
        String youtubeUrl,
        String thumbnailUrl
) {
    public static SermonVideo of(String videoId, String title, Instant publishedAt) {
        return new SermonVideo(videoId, title, publishedAt,
                YoutubeUrls.watch(videoId), YoutubeUrls.thumbnail(videoId));
    }
}
