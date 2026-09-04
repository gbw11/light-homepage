package kr.light.sermon;

import java.util.List;
import java.util.Optional;

/**
 * YouTube Data API와 이야기하는 부분 (SPEC_API.md §9.2 · §9.3).
 *
 * <p><b>인터페이스로 두는 이유는 테스트다.</b> YouTube를 실제로 부르는 테스트는
 * 만들 수 없다 — 네트워크가 필요하고 <b>쿼터를 쓰며</b>, 라이브는 실제 방송이
 * 켜져 있어야만 재현된다. 그런데 정작 확인해야 하는 것은 YouTube가 아니라
 * <b>우리 쪽 판단</b>이다: 설교를 골라내는 규칙, 캐시가 실제로 쿼터를
 * 아끼는지, 실패했을 때 화면이 깨지지 않는지.
 *
 * <h2>쿼터를 의식한 설계</h2>
 * 하루 10,000 units다. 라이브 판정의 표준 방법인 {@code search.list}는
 * <b>1회 100 units</b>라, 60초 캐시로 하루 1,440회를 부르면 144,000 units가
 * 되어 <b>한도의 14배</b>다. 그래서 이 인터페이스는 그 호출을 쓰지 않는다 —
 * {@code playlistItems.list}(1)와 {@code videos.list}(1)만 쓴다.
 */
public interface YoutubeClient {

    /**
     * 재생목록의 영상을 최신순으로 가져온다.
     *
     * <p>{@code playlistItems.list} — 페이지당 1 unit, 최대 50편.
     * 210편이면 5회 호출(5 units)로 전부 읽는다.
     *
     * @param max 최대 편수. 이 수를 넘기면 그만둔다
     * @throws YoutubeException 호출이 실패한 경우
     */
    List<PlaylistVideo> fetchPlaylist(String playlistId, int max);

    /**
     * 이 영상들 중 <b>지금 방송 중인 것</b>을 찾는다.
     *
     * <p>{@code videos.list} — <b>여러 id를 한 번에 물어도 1 unit</b>이다.
     * 그래서 최근 몇 편을 묶어 보내고 그중 라이브를 고른다.
     *
     * @throws YoutubeException 호출이 실패한 경우
     */
    Optional<LiveBroadcast> findLive(List<String> videoIds);

    /** 재생목록 항목 — 설교 여부를 가리기 전의 원본 */
    record PlaylistVideo(String videoId, String title, java.time.Instant publishedAt) {
    }
}
