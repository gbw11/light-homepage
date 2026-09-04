package kr.light.sermon;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * 설교 목록·라이브 판정 (SPEC_API.md §9.2 · §9.3).
 *
 * <h2>★ 캐시가 이 클래스의 핵심이다</h2>
 * YouTube 쿼터는 하루 <b>10,000 units</b>다. 캐시가 없으면 방문자 수에
 * 비례해 호출이 늘고, 소진되면 <b>그날 하루 설교 화면이 통째로 빈다.</b>
 *
 * <p>그래서 캐시는 성능 장치가 아니라 <b>기능을 지키는 장치</b>다.
 *
 * <table>
 *   <tr><th></th><th>TTL</th><th>1회 비용</th><th>최악의 하루</th></tr>
 *   <tr><td>목록 §9.2</td><td>6시간</td><td>5 units(210편)</td><td>20 units</td></tr>
 *   <tr><td>라이브 §9.3</td><td>60초</td><td>2 units</td><td>2,880 units</td></tr>
 * </table>
 *
 * <p>목록 TTL이 6시간인 근거: 설교는 <b>주 1회</b> 올라간다. 더 짧게 잡을
 * 이유가 없다. 라이브 TTL 60초는 <b>계약이 정한 상한</b>이다 — 화면이
 * 60초마다 물어보므로 그보다 길면 방송 시작이 그만큼 늦게 반영된다 (§9.3).
 *
 * <h2>실패는 "없음"으로 바꾼다</h2>
 * YouTube가 죽거나 쿼터가 소진되면 <b>빈 목록·null</b>을 준다 (§9.2 · §9.3).
 * 502를 주면 화면 전체가 에러로 바뀌는데, FE는 빈 목록을 이미 "아직 등록된
 * 영상이 없습니다"로 처리한다. <b>로그에는 크게 남긴다</b> — 쿼터 소진은
 * 우리가 알아야 한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SermonService {

    /** 설교는 주 1회 올라간다 (§9.2 "수 시간 캐시가 안전합니다") */
    private static final Duration LIST_TTL = Duration.ofHours(6);

    /** ★ 계약이 정한 상한. 더 늘리면 방송 시작이 늦게 반영된다 (§9.3) */
    private static final Duration LIVE_TTL = Duration.ofSeconds(60);

    /**
     * 목록에서 한 번에 읽어 둘 최대 편수.
     *
     * <p>채널에 210편이 있다. 넉넉히 잡아 <b>전부 메모리에 두고 페이징한다</b> —
     * YouTube는 페이지 토큰 방식이라 {@code page=5}를 바로 집을 수 없고,
     * 게다가 설교만 골라내면 원본과 번호가 달라진다. 전부 받아두면 그 두
     * 문제가 함께 사라지고, 6시간에 5 units면 값이 충분히 싸다.
     */
    private static final int MAX_VIDEOS = 300;

    /**
     * 라이브를 찾을 때 확인할 최근 편수.
     *
     * <p>방송이 시작되면 업로드 재생목록 <b>맨 앞</b>에 들어온다. 여유를 두어
     * 앞쪽 몇 편만 본다 — {@code videos.list}는 여러 id를 한 번에 물어도
     * 1 unit이라 편수를 늘려도 비용이 같다.
     */
    private static final int LIVE_LOOKBACK = 5;

    private final YoutubeClient youtubeClient;
    private final YoutubeProperties properties;

    private final Cached<List<SermonVideo>> sermons = new Cached<>();
    private final Cached<Optional<LiveBroadcast>> live = new Cached<>();

    // ── §9.2 목록 ────────────────────────────────────────────────────

    /**
     * 설교 목록 — <b>최신순</b>. 화면이 정렬하지 않는다 (§9.2).
     *
     * @param page 0부터
     * @param size 한 페이지 크기
     */
    public SermonPage list(int page, int size) {
        List<SermonVideo> all = cachedSermons();

        int from = Math.min(page * size, all.size());
        int to = Math.min(from + size, all.size());

        return new SermonPage(all.subList(from, to), page, size, to < all.size());
    }

    // ── §9.3 라이브 ──────────────────────────────────────────────────

    /**
     * 지금 방송 중인 라이브. 없으면 {@link Optional#empty()}.
     *
     * <p>⚠️ <b>요일로 걸러내지 않는다</b> (§9.3). 특별집회 등 다른 요일 방송도
     * 그대로 떠야 한다 — "지금 라이브인가"만 판단한다.
     */
    public Optional<LiveBroadcast> findLive() {
        return live.get(LIVE_TTL, () -> {
            if (!properties.isConfigured()) {
                return Optional.empty();
            }
            try {
                List<String> recent = youtubeClient
                        .fetchPlaylist(properties.sourcePlaylistId(), LIVE_LOOKBACK)
                        .stream()
                        .map(YoutubeClient.PlaylistVideo::videoId)
                        .toList();
                return youtubeClient.findLive(recent);
            } catch (YoutubeException e) {
                // 방송이 없는 것으로 보이게 한다 — 화면은 정상 동작한다
                log.warn("라이브 판정 실패, 없는 것으로 응답한다: {}", e.getMessage());
                return Optional.empty();
            }
        });
    }

    // ── 내부 ─────────────────────────────────────────────────────────

    private List<SermonVideo> cachedSermons() {
        return sermons.get(LIST_TTL, () -> {
            if (!properties.isConfigured()) {
                // 키를 넣지 않은 상태다. 빈 목록이 나가고 화면은 "아직 등록된
                // 영상이 없습니다"를 띄운다 — 500으로 터뜨리지 않는다.
                log.warn("app.youtube.api-key가 비어 있습니다 — 설교 목록이 빈 채로 나갑니다");
                return List.of();
            }
            try {
                return youtubeClient
                        .fetchPlaylist(properties.sourcePlaylistId(), MAX_VIDEOS)
                        .stream()
                        // 재생목록이 지정돼 있으면 사람이 이미 골라 담은 것이라
                        // 제목 규칙을 덧씌우지 않는다
                        .filter(v -> properties.hasPlaylist() || SermonTitles.isSermon(v.title()))
                        .map(v -> SermonVideo.of(v.videoId(), v.title(), v.publishedAt()))
                        .toList();
            } catch (YoutubeException e) {
                log.error("설교 목록을 가져오지 못했습니다, 빈 목록으로 응답한다: {}", e.getMessage());
                return List.of();
            }
        });
    }

    // ── 테스트용 이음새 ───────────────────────────────────────────────

    /**
     * 캐시를 비운다.
     *
     * <p>테스트가 서로를 오염시키지 않게 하려면 필요하다 — 캐시가 인스턴스에
     * 남아 앞 테스트의 응답이 뒤 테스트에 그대로 나온다.
     */
    void clearCacheForTest() {
        sermons.clear();
        live.clear();
    }

    /**
     * 라이브 캐시 TTL.
     *
     * <p>테스트가 <b>60초 상한</b>을 직접 검증한다 (§9.3). 이 값을 늘리는
     * 변경이 조용히 들어오면 방송 시작이 그만큼 늦게 반영되는데, 화면만
     * 보고는 알아채기 어렵다.
     */
    static Duration liveCacheTtlForTest() {
        return LIVE_TTL;
    }

    /** 목록 한 페이지 */
    public record SermonPage(List<SermonVideo> items, int page, int size, boolean hasNext) {
    }

    /**
     * TTL이 있는 값 하나.
     *
     * <p>스프링 캐시 스타터를 들이지 않은 이유 — 캐시할 대상이 둘이고 TTL이
     * 서로 다르며(6시간 · 60초), <b>TTL이 계약의 일부</b>라 테스트에서 직접
     * 다뤄야 한다. 애너테이션으로 감추면 "60초를 넘기지 않는다"를 검증하기
     * 어려워진다.
     *
     * <p>⚠️ 인스턴스 안의 기억이다. 재시작하면 비고, 인스턴스를 늘리면
     * 각자 갖는다 — 지금은 Render 단일 인스턴스라 성립한다. 늘릴 때는
     * 공유 캐시로 옮겨야 한다 (시도 제한과 같은 제약).
     */
    private static final class Cached<T> {
        private T value;
        private Instant loadedAt;

        synchronized void clear() {
            value = null;
            loadedAt = null;
        }

        synchronized T get(Duration ttl, java.util.function.Supplier<T> loader) {
            Instant now = Instant.now();
            if (value == null || loadedAt == null || loadedAt.plus(ttl).isBefore(now)) {
                value = loader.get();
                loadedAt = now;
            }
            return value;
        }
    }
}
