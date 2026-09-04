package kr.light.sermon;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atMostOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 설교 영상 (SPEC_API.md §9.2 · §9.3).
 *
 * <p><b>YouTube는 부르지 않는다.</b> 네트워크가 필요하고 <b>쿼터를 쓰며</b>,
 * 라이브는 실제 방송이 켜져 있어야만 재현된다. 정작 확인해야 하는 것은
 * YouTube가 아니라 <b>우리 쪽 판단</b>이다 — 설교를 골라내는 규칙, 캐시가
 * 실제로 쿼터를 아끼는지, 실패했을 때 화면이 깨지지 않는지.
 *
 * <p>⚠️ 이름에 {@code Authorization}을 넣지 않았다. 인가 매트릭스가 아니다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SermonApiTest {

    @Autowired MockMvc mockMvc;
    @Autowired SermonService sermonService;

    /** YouTube 서버 역할 */
    @MockitoBean YoutubeClient youtubeClient;

    /** 실제 채널 제목 형태를 그대로 쓴다 */
    private static final List<YoutubeClient.PlaylistVideo> CHANNEL = List.of(
            video("aaaaaaaaaaa", "2026년 8월 30일 l 하나님께 소망을 두고 있나요? l [김해교회 LIGHT청년교회]"),
            video("bbbbbbbbbbb", "2026 하계수련회 보고영상 | LIGHT 청년교회"),
            video("ccccccccccc", "2026년 8월 23일 l 세상을 비추는 빛 l [김해교회 LIGHT청년교회]"),
            video("ddddddddddd", "2026년 8월 16일 빛나는 우리 [김해교회 LIGHT청년교회]"),
            video("eeeeeeeeeee", "찬양 커버 - 나의 반석"));

    private static YoutubeClient.PlaylistVideo video(String id, String title) {
        return new YoutubeClient.PlaylistVideo(id, title, Instant.parse("2026-08-30T05:00:00Z"));
    }

    @BeforeEach
    void setUp() {
        // 캐시가 테스트 사이에 남으면 서로를 오염시킨다
        sermonService.clearCacheForTest();

        when(youtubeClient.fetchPlaylist(anyString(), anyInt())).thenReturn(CHANNEL);
        when(youtubeClient.findLive(any())).thenReturn(Optional.empty());
    }

    // ── §9.2 목록 ─────────────────────────────────────────────

    @Nested
    @DisplayName("목록")
    class Listing {

        @Test
        @DisplayName("로그인 없이 열린다 — 권한 G")
        void 비로그인으로_열린다() throws Exception {
            mockMvc.perform(get("/api/sermons"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.items").isArray());
        }

        @Test
        @DisplayName("★ 설교가 아닌 영상은 걸러진다 — 브이로그·찬양 커버가 말씀 목록에 뜨면 안 된다")
        void 설교만_남는다() throws Exception {
            mockMvc.perform(get("/api/sermons"))
                    .andExpect(status().isOk())
                    // 5편 중 제목이 날짜로 시작하는 3편만
                    .andExpect(jsonPath("$.data.items.length()").value(3))
                    .andExpect(jsonPath("$.data.items[0].title").value(
                            org.hamcrest.Matchers.startsWith("2026년 8월 30일")));
        }

        @Test
        @DisplayName("★ '2026 하계수련회'처럼 연도만 있는 제목도 걸러진다")
        void 연도만_있는_제목은_설교가_아니다() throws Exception {
            String body = mockMvc.perform(get("/api/sermons"))
                    .andExpect(status().isOk())
                    .andReturn().getResponse().getContentAsString();

            assertThat(body).doesNotContain("하계수련회").doesNotContain("찬양 커버");
        }

        @Test
        @DisplayName("계약 형태대로 나온다 (§9.2)")
        void 응답_형태() throws Exception {
            mockMvc.perform(get("/api/sermons"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.items[0].id").value("aaaaaaaaaaa"))
                    .andExpect(jsonPath("$.data.items[0].youtubeUrl")
                            .value("https://www.youtube.com/watch?v=aaaaaaaaaaa"))
                    .andExpect(jsonPath("$.data.items[0].thumbnailUrl")
                            .value("https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg"))
                    .andExpect(jsonPath("$.data.items[0].publishedAt").value("2026-08-30T05:00:00Z"))
                    .andExpect(jsonPath("$.data.page").value(0))
                    .andExpect(jsonPath("$.data.size").value(12))
                    .andExpect(jsonPath("$.data.hasNext").value(false));
        }

        @Test
        @DisplayName("페이징 — size를 넘기면 hasNext가 true다")
        void 페이징() throws Exception {
            mockMvc.perform(get("/api/sermons").param("size", "2"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.items.length()").value(2))
                    .andExpect(jsonPath("$.data.hasNext").value(true));

            mockMvc.perform(get("/api/sermons").param("size", "2").param("page", "1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.items.length()").value(1))
                    .andExpect(jsonPath("$.data.hasNext").value(false));
        }

        @Test
        @DisplayName("범위를 벗어난 page는 빈 목록 — 400이 아니다")
        void 범위를_넘는_page() throws Exception {
            mockMvc.perform(get("/api/sermons").param("page", "99"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.items").isEmpty());
        }

        @Test
        @DisplayName("size는 50을 넘겨도 50으로 잘린다 — 400이 아니다")
        void size_상한() throws Exception {
            mockMvc.perform(get("/api/sermons").param("size", "5000"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.size").value(50));
        }

        @Test
        @DisplayName("★ YouTube가 실패하면 빈 목록 — 502가 아니다")
        void 실패하면_빈_목록() throws Exception {
            when(youtubeClient.fetchPlaylist(anyString(), anyInt()))
                    .thenThrow(new YoutubeException("quotaExceeded"));
            sermonService.clearCacheForTest();

            // 화면 전체가 에러로 바뀌는 것보다 "아직 등록된 영상이 없습니다"가 낫다
            mockMvc.perform(get("/api/sermons"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.items").isEmpty());
        }

        @Test
        @DisplayName("★ 두 번 불러도 YouTube는 한 번만 부른다 — 캐시가 쿼터를 지킨다")
        void 캐시가_쿼터를_아낀다() throws Exception {
            mockMvc.perform(get("/api/sermons")).andExpect(status().isOk());
            mockMvc.perform(get("/api/sermons")).andExpect(status().isOk());
            mockMvc.perform(get("/api/sermons").param("page", "1")).andExpect(status().isOk());

            // 캐시가 없으면 방문자 수에 비례해 호출이 늘고, 하루 10,000 units가
            // 소진되면 그날 설교 화면이 통째로 빈다
            verify(youtubeClient, atMostOnce()).fetchPlaylist(anyString(), anyInt());
        }
    }

    // ── §9.3 라이브 ───────────────────────────────────────────

    @Nested
    @DisplayName("라이브")
    class Live {

        @Test
        @DisplayName("★ 방송 중이 아니면 data가 null이다 — 404도, 빈 객체도 아니다")
        void 방송이_없으면_null() throws Exception {
            // 빈 객체나 live:false를 쓰면 FE의 화면 분기가 둘로 갈린다 (§9.3)
            mockMvc.perform(get("/api/sermons/live"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data").doesNotExist());
        }

        @Test
        @DisplayName("방송 중이면 계약 형태대로 나온다 (§9.3)")
        void 방송_중() throws Exception {
            when(youtubeClient.findLive(any())).thenReturn(Optional.of(
                    LiveBroadcast.of("SaVEqB82v7Y", "2026년 9월 7일 주일 청년예배",
                            Instant.parse("2026-09-07T04:45:00Z"))));
            sermonService.clearCacheForTest();

            mockMvc.perform(get("/api/sermons/live"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.videoId").value("SaVEqB82v7Y"))
                    .andExpect(jsonPath("$.data.title").value("2026년 9월 7일 주일 청년예배"))
                    .andExpect(jsonPath("$.data.startedAt").value("2026-09-07T04:45:00Z"))
                    .andExpect(jsonPath("$.data.watchUrl")
                            .value("https://www.youtube.com/watch?v=SaVEqB82v7Y"))
                    .andExpect(jsonPath("$.data.thumbnailUrl")
                            .value("https://i.ytimg.com/vi/SaVEqB82v7Y/hqdefault.jpg"));
        }

        @Test
        @DisplayName("★ 요일로 걸러내지 않는다 — 특별집회도 떠야 한다")
        void 요일을_보지_않는다() throws Exception {
            // 수요일 방송
            when(youtubeClient.findLive(any())).thenReturn(Optional.of(
                    LiveBroadcast.of("WedNesDay01", "특별집회 2일차",
                            Instant.parse("2026-09-09T10:00:00Z"))));
            sermonService.clearCacheForTest();

            mockMvc.perform(get("/api/sermons/live"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.videoId").value("WedNesDay01"));
        }

        @Test
        @DisplayName("★ YouTube가 실패하면 null — 화면이 에러로 바뀌지 않는다")
        void 실패하면_null() throws Exception {
            when(youtubeClient.findLive(any())).thenThrow(new YoutubeException("quotaExceeded"));
            sermonService.clearCacheForTest();

            mockMvc.perform(get("/api/sermons/live"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data").doesNotExist());
        }

        @Test
        @DisplayName("★ 60초 안에는 YouTube를 다시 부르지 않는다")
        void 캐시가_동작한다() throws Exception {
            for (int i = 0; i < 5; i++) {
                mockMvc.perform(get("/api/sermons/live")).andExpect(status().isOk());
            }

            // 60초 캐시가 없으면 화면이 60초마다 물어보는 것이 그대로 쿼터가 된다
            verify(youtubeClient, atMostOnce()).findLive(any());
        }
    }

    @Test
    @DisplayName("★ 라이브 TTL은 60초를 넘지 않는다 — 계약이 정한 상한이다")
    void 라이브_TTL_상한() {
        // 더 길면 방송 시작이 그만큼 늦게 반영된다 (§9.3). 숫자를 늘리는
        // 변경이 조용히 들어오는 것을 막는다.
        assertThat(SermonService.liveCacheTtlForTest().toSeconds()).isLessThanOrEqualTo(60);
    }
}
