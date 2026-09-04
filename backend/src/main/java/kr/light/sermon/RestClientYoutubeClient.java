package kr.light.sermon;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * YouTube Data API v3 호출 (SPEC_API.md §9.2 · §9.3).
 *
 * <p><b>타임아웃을 반드시 건다.</b> YouTube가 응답하지 않으면 요청 스레드가
 * 묶이는데 우리 톰캣 스레드는 20개뿐이다 — 남의 장애가 우리 사이트를
 * 멈추게 할 수 있다 (카카오 연동과 같은 이유).
 *
 * <h2>쓰는 호출과 비용</h2>
 * <ul>
 *   <li>{@code playlistItems.list} — 1 unit / 페이지(최대 50편)</li>
 *   <li>{@code videos.list} — 1 unit, <b>여러 id를 한 번에</b></li>
 * </ul>
 * {@code search.list}(100 units)는 쓰지 않는다 — {@link YoutubeClient} 주석 참고.
 */
@Slf4j
@Component
public class RestClientYoutubeClient implements YoutubeClient {

    private static final String BASE = "https://www.googleapis.com/youtube/v3";

    /** YouTube가 한 번에 주는 최대치 */
    private static final int PAGE_SIZE = 50;

    /** 사람이 화면에서 기다리는 시간이다. 길게 잡을 이유가 없다 */
    private static final Duration TIMEOUT = Duration.ofSeconds(5);

    /** 라이브 판정에 쓰는 값 (snippet.liveBroadcastContent) */
    private static final String LIVE = "live";

    private final YoutubeProperties properties;
    private final RestClient restClient;

    public RestClientYoutubeClient(YoutubeProperties properties) {
        this.properties = properties;

        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(TIMEOUT);
        factory.setReadTimeout(TIMEOUT);
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    @Override
    public List<PlaylistVideo> fetchPlaylist(String playlistId, int max) {
        List<PlaylistVideo> collected = new ArrayList<>();
        String pageToken = null;

        // 페이지당 1 unit. 210편이면 5회로 끝난다.
        while (collected.size() < max) {
            JsonNode body = fetchPage(playlistId, max - collected.size(), pageToken);
            collected.addAll(toVideos(body));

            pageToken = text(body, "nextPageToken");
            if (pageToken == null) {
                break;      // 마지막 페이지
            }
        }
        return collected.size() > max ? List.copyOf(collected.subList(0, max)) : collected;
    }

    @Override
    public Optional<LiveBroadcast> findLive(List<String> videoIds) {
        if (videoIds.isEmpty()) {
            return Optional.empty();
        }

        JsonNode body = get("videos", uri -> uri
                .queryParam("part", "snippet,liveStreamingDetails")
                .queryParam("id", String.join(",", videoIds)));

        for (JsonNode video : body.path("items")) {
            JsonNode snippet = video.path("snippet");
            if (!LIVE.equals(snippet.path("liveBroadcastContent").asText())) {
                continue;
            }
            // 실제 방송 시작 시각. 없으면 게시 시각으로 물러선다 —
            // 화면이 "언제 시작했는지"를 보여줄 뿐이라 치명적이지 않다.
            Instant startedAt = parseTime(
                    video.path("liveStreamingDetails").path("actualStartTime").asText(null));
            if (startedAt == null) {
                startedAt = parseTime(snippet.path("publishedAt").asText(null));
            }
            return Optional.of(LiveBroadcast.of(
                    video.path("id").asText(), snippet.path("title").asText(), startedAt));
        }
        return Optional.empty();
    }

    // ── 내부 ─────────────────────────────────────────────────────────

    /** {@code pageToken}이 null이면 첫 페이지 */
    private JsonNode fetchPage(String playlistId, int remaining, String pageToken) {
        return get("playlistItems", uri -> {
            uri.queryParam("part", "snippet,contentDetails")
                    .queryParam("playlistId", playlistId)
                    .queryParam("maxResults", Math.min(PAGE_SIZE, remaining));
            if (pageToken != null) {
                uri.queryParam("pageToken", pageToken);
            }
            return uri;
        });
    }

    private List<PlaylistVideo> toVideos(JsonNode body) {
        List<PlaylistVideo> videos = new ArrayList<>();
        for (JsonNode item : body.path("items")) {
            String videoId = item.path("contentDetails").path("videoId").asText(null);
            String title = item.path("snippet").path("title").asText(null);
            if (videoId == null || title == null) {
                continue;   // 삭제·비공개로 바뀐 항목은 조용히 건너뛴다
            }
            videos.add(new PlaylistVideo(videoId, title,
                    parseTime(item.path("contentDetails").path("videoPublishedAt").asText(null))));
        }
        return videos;
    }

    private JsonNode get(String endpoint,
                         java.util.function.UnaryOperator<org.springframework.web.util.UriBuilder> customizer) {
        try {
            JsonNode body = restClient.get()
                    .uri(BASE + "/" + endpoint, uri -> customizer
                            .apply(uri.queryParam("key", properties.apiKey()))
                            .build())
                    .retrieve()
                    // ★ 4xx에서도 본문을 읽는다. 기본 동작은 본문을 읽기 전에
                    //   예외를 던져 YouTube가 알려준 원인(quotaExceeded 등)을
                    //   통째로 잃는다 — 카카오 연동에서 그 때문에 막힌 적이 있다.
                    .onStatus(HttpStatusCode::isError, (request, response) -> { })
                    .body(JsonNode.class);

            if (body == null || body.has("error")) {
                throw new YoutubeException(
                        "%s 실패: %s".formatted(endpoint, reasonOf(body)));
            }
            return body;
        } catch (RestClientException e) {
            throw new YoutubeException("YouTube에 연결하지 못했습니다: " + endpoint, e);
        }
    }

    /**
     * 오류 사유만 남긴다.
     *
     * <p>{@code quotaExceeded}·{@code keyInvalid}는 우리가 알아야 하는 값이다.
     * ⚠️ 본문 전체를 남기지 않는다 — 쿼리에 API 키가 실려 있다.
     */
    private static String reasonOf(JsonNode body) {
        if (body == null) {
            return "응답 본문 없음";
        }
        JsonNode error = body.path("error");
        String reason = error.path("errors").path(0).path("reason").asText(null);
        return reason != null ? reason : "code=" + error.path("code").asText("알 수 없음");
    }

    private static String text(JsonNode body, String field) {
        JsonNode value = body.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    /** YouTube는 ISO-8601 UTC를 준다. 깨진 값이면 null로 두고 넘어간다 */
    private static Instant parseTime(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(raw);
        } catch (DateTimeParseException e) {
            log.warn("YouTube 시각을 읽지 못했습니다: {}", raw);
            return null;
        }
    }
}
