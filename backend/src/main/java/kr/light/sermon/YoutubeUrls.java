package kr.light.sermon;

/**
 * YouTube 공개 주소 조립.
 *
 * <p>썸네일은 <b>YouTube CDN 주소를 그대로</b> 넘긴다 (SPEC_API.md §9.2).
 * 우리가 받아서 다시 내보내면 트래픽만 늘고 느려진다. FE는 {@code <img>}로
 * 직접 로드하고, <b>404가 오면 자리표시자로 넘어간다</b> — 영상이 비공개로
 * 바뀌는 경우가 있어서다.
 */
public final class YoutubeUrls {

    private YoutubeUrls() {
    }

    public static String watch(String videoId) {
        return "https://www.youtube.com/watch?v=" + videoId;
    }

    /**
     * {@code hqdefault} 를 쓴다 — 480×360으로 목록 카드에 충분하고,
     * {@code maxresdefault}는 영상에 따라 <b>없을 때가 있다</b>(404).
     */
    public static String thumbnail(String videoId) {
        return "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg";
    }
}
