package kr.light.album;

import com.fasterxml.jackson.databind.ObjectMapper;
import kr.light.auth.AuthPrincipal;
import kr.light.member.Role;
import kr.light.photo.Photo;
import kr.light.photo.PhotoRepository;
import kr.light.photo.PhotoStatus;
import kr.light.storage.R2Client;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 오래된 앨범 정리 (SPEC_API.md §6.11 · FR-PHO-11).
 *
 * <p><b>★ 되돌릴 수 없는 동작이라 "무엇이 지워지는가"가 계약의 핵심이다.</b>
 * 미리보기에서 본 것과 실제로 지워지는 것이 어긋나면, 사용자는 그 사실을
 * R2에서 사진이 사라진 뒤에야 안다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AlbumPurgeApiTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired AlbumRepository albumRepository;
    @Autowired PhotoRepository photoRepository;

    @MockitoBean R2Client r2Client;

    @BeforeEach
    void setUp() {
        photoRepository.deleteAllInBatch();
        albumRepository.deleteAllInBatch();
    }

    @Nested
    @DisplayName("미리보기")
    class Candidates {

        @Test
        @DisplayName("행사일이 오래된 것부터 나온다")
        void 오래된_순() throws Exception {
            saveAlbum("2024 수련회", LocalDate.of(2024, 8, 1));
            saveAlbum("2022 수련회", LocalDate.of(2022, 8, 1));
            saveAlbum("2023 수련회", LocalDate.of(2023, 8, 1));

            mockMvc.perform(withRole(get("/api/admin/albums/purge-candidates"), Role.PASTOR))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data[0].title").value("2022 수련회"))
                    .andExpect(jsonPath("$.data[1].title").value("2023 수련회"))
                    .andExpect(jsonPath("$.data[2].title").value("2024 수련회"));
        }

        @Test
        @DisplayName("★ 행사일이 없는 앨범은 나오지 않는다 — 오래됐다고 판단할 근거가 없다")
        void 행사일_없으면_제외() throws Exception {
            saveAlbum("날짜 없는 앨범", null);
            saveAlbum("2023 수련회", LocalDate.of(2023, 8, 1));

            mockMvc.perform(withRole(get("/api/admin/albums/purge-candidates"), Role.PASTOR))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.length()").value(1))
                    .andExpect(jsonPath("$.data[0].title").value("2023 수련회"));
        }

        @Test
        @DisplayName("★ 미리보기는 아무것도 지우지 않는다")
        void 미리보기는_지우지_않는다() throws Exception {
            Album album = saveAlbum("2022 수련회", LocalDate.of(2022, 8, 1));
            savePhoto(album, PhotoStatus.COMMITTED, 1_000);

            mockMvc.perform(withRole(get("/api/admin/albums/purge-candidates"), Role.PASTOR))
                    .andExpect(status().isOk());

            verify(r2Client, never()).deleteAll(org.mockito.ArgumentMatchers.any());
            assertThat(albumRepository.count()).isOne();
            assertThat(photoRepository.count()).isOne();
        }

        @Test
        @DisplayName("사진 수와 회수 가능한 용량을 함께 준다")
        void 개수와_용량() throws Exception {
            Album album = saveAlbum("2022 수련회", LocalDate.of(2022, 8, 1));
            savePhoto(album, PhotoStatus.COMMITTED, 1_500);
            savePhoto(album, PhotoStatus.COMMITTED, 2_500);

            mockMvc.perform(withRole(get("/api/admin/albums/purge-candidates"), Role.PASTOR))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data[0].photoCount").value(2))
                    .andExpect(jsonPath("$.data[0].sizeBytes").value(4_000));
        }

        @Test
        @DisplayName("⚠️ PENDING은 용량 합계에 없다 — size_bytes가 0이다")
        void 미커밋은_합계에_없다() throws Exception {
            Album album = saveAlbum("2022 수련회", LocalDate.of(2022, 8, 1));
            savePhoto(album, PhotoStatus.COMMITTED, 1_000);
            savePhoto(album, PhotoStatus.PENDING, 0);

            mockMvc.perform(withRole(get("/api/admin/albums/purge-candidates"), Role.PASTOR))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data[0].photoCount").value(1))
                    .andExpect(jsonPath("$.data[0].sizeBytes").value(1_000));
        }

        @Test
        @DisplayName("count는 기본 5, 최대 20으로 자른다")
        void count_상한() {
            assertThat(AlbumPurgeService.normalizeCount(100)).isEqualTo(20);
            assertThat(AlbumPurgeService.normalizeCount(null)).isEqualTo(5);
            assertThat(AlbumPurgeService.normalizeCount(0)).isEqualTo(5);
            assertThat(AlbumPurgeService.normalizeCount(3)).isEqualTo(3);
        }
    }

    @Nested
    @DisplayName("정리 실행")
    class Purge {

        @Test
        @DisplayName("★ 지정한 앨범의 사진과 R2 객체가 함께 사라진다")
        void 앨범과_객체를_지운다() throws Exception {
            Album album = saveAlbum("2022 수련회", LocalDate.of(2022, 8, 1));
            Photo photo = savePhoto(album, PhotoStatus.COMMITTED, 1_000);

            mockMvc.perform(purgeRequest(Role.PASTOR, album.getId()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.deletedAlbums").value(1))
                    .andExpect(jsonPath("$.data.deletedPhotos").value(1))
                    .andExpect(jsonPath("$.data.freedBytes").value(1_000));

            @SuppressWarnings("unchecked")
            ArgumentCaptor<Collection<String>> keys = ArgumentCaptor.forClass(Collection.class);
            verify(r2Client).deleteAll(keys.capture());
            assertThat(keys.getValue())
                    .as("view와 thumb 둘 다")
                    .containsExactlyInAnyOrder(photo.getR2KeyView(), photo.getR2KeyThumb());

            assertThat(albumRepository.count()).isZero();
            assertThat(photoRepository.count()).isZero();
        }

        @Test
        @DisplayName("⚠️ PENDING 사진의 R2 객체도 지운다 — 남기면 고아가 된다")
        void 미커밋도_지운다() throws Exception {
            Album album = saveAlbum("2022 수련회", LocalDate.of(2022, 8, 1));
            savePhoto(album, PhotoStatus.PENDING, 0);

            mockMvc.perform(purgeRequest(Role.PASTOR, album.getId()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.deletedPhotos").value(1))
                    .andExpect(jsonPath("$.data.freedBytes").value(0));

            verify(r2Client).deleteAll(org.mockito.ArgumentMatchers.any());
            assertThat(photoRepository.count()).isZero();
        }

        @Test
        @DisplayName("★ 없는 id가 섞이면 전체가 실패한다 — 일부만 지워지지 않는다")
        void 없는_id면_전체_실패() throws Exception {
            Album album = saveAlbum("2022 수련회", LocalDate.of(2022, 8, 1));
            savePhoto(album, PhotoStatus.COMMITTED, 1_000);

            mockMvc.perform(purgeRequest(Role.PASTOR, album.getId(), 999_999L))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));

            assertThat(albumRepository.count())
                    .as("첫 앨범도 지워지지 않아야 한다")
                    .isOne();
            assertThat(photoRepository.count()).isOne();
        }

        @Test
        @DisplayName("빈 목록은 400 — 실수로 전체를 지우는 호출을 만들지 않는다")
        void 빈_목록은_400() throws Exception {
            mockMvc.perform(withRole(post("/api/admin/albums/purge"), Role.PASTOR)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"albumIds\": []}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
        }
    }

    // 보조 ────────────────────────────────────────────────────

    private MockHttpServletRequestBuilder purgeRequest(Role role, Long... albumIds) throws Exception {
        return withRole(post("/api/admin/albums/purge"), role)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("albumIds", List.of(albumIds))));
    }

    private Album saveAlbum(String title, LocalDate eventDate) {
        return albumRepository.saveAndFlush(Album.builder()
                .title(title)
                .eventDate(eventDate)
                .build());
    }

    private Photo savePhoto(Album album, PhotoStatus status, long sizeBytes) {
        return photoRepository.saveAndFlush(Photo.builder()
                .album(album)
                .r2KeyView("albums/" + album.getId() + "/view-" + System.nanoTime() + ".webp")
                .r2KeyThumb("albums/" + album.getId() + "/thumb-" + System.nanoTime() + ".webp")
                .sizeBytes(sizeBytes)
                .status(status)
                .build());
    }

    private MockHttpServletRequestBuilder withRole(MockHttpServletRequestBuilder builder, Role role) {
        if (role == null) {
            return builder;
        }
        AuthPrincipal principal = new AuthPrincipal(1L, role);
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities());
        return builder.with(authentication(authentication));
    }
}
