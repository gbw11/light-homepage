package kr.light.album;

import com.fasterxml.jackson.databind.ObjectMapper;
import kr.light.auth.AuthPrincipal;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
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
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 사진첩 — 앨범과 사진 목록 (SPEC_API.md §6.1~§6.4).
 *
 * <p>무게가 실린 곳은 <b>커서 페이징</b>이다. 앨범 하나에 수백 장이 들어가고
 * 무한 스크롤로 훑는데, 중간에 한 장이 지워졌을 때 다음 페이지가 밀려
 * <b>사진 하나를 건너뛰는</b> 것이 offset 페이징의 전형적인 사고다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AlbumApiTest {

    private static final String PRESIGNED = "https://r2.example/get?X-Amz-Signature=stub";

    @Autowired MockMvc mockMvc;
    @Autowired AlbumRepository albumRepository;
    @Autowired PhotoRepository photoRepository;
    @Autowired MemberRepository memberRepository;
    @Autowired ObjectMapper objectMapper;

    @MockitoBean R2Client r2Client;

    private Member leader;
    private Member member;
    private Album album;

    @BeforeEach
    void setUp() {
        photoRepository.deleteAllInBatch();
        albumRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();

        given(r2Client.presignedGetUrl(anyString())).willReturn(PRESIGNED);

        leader = memberRepository.saveAndFlush(Member.builder()
                .name("시드임원").loginId("leader").role(Role.LEADER).build());
        member = memberRepository.saveAndFlush(Member.builder()
                .name("시드회원").loginId("member").role(Role.MEMBER).build());
        album = albumRepository.saveAndFlush(Album.builder()
                .title("2026 여름수련회").eventDate(LocalDate.of(2026, 8, 1)).build());
    }

    // ── §6.1 · §6.2 · §6.3 앨범 ──────────────────────────────

    @Nested
    @DisplayName("앨범")
    class Albums {

        @Test
        @DisplayName("만들면 201과 id가 온다")
        void 생성() throws Exception {
            mockMvc.perform(post("/api/albums").with(as(leader))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of(
                                    "title", "2026 가을 체육대회", "eventDate", "2026-10-03"))))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.data.id").isString());

            assertThat(albumRepository.count()).isEqualTo(2);
        }

        @Test
        @DisplayName("이름이 비면 400")
        void 빈_이름() throws Exception {
            mockMvc.perform(post("/api/albums").with(as(leader))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("title", "  "))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.field").value("title"));
        }

        @Test
        @DisplayName("행사일은 없어도 된다")
        void 행사일_없음() throws Exception {
            mockMvc.perform(post("/api/albums").with(as(leader))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("title", "언젠가"))))
                    .andExpect(status().isCreated());
        }

        @Test
        @DisplayName("★ 사진이 없는 앨범의 coverThumbUrl은 null이다")
        void 커버가_없으면_null() throws Exception {
            mockMvc.perform(get("/api/albums").with(as(member)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.items[0].photoCount").value(0))
                    .andExpect(jsonPath("$.data.items[0].coverThumbUrl")
                            .value(org.hamcrest.Matchers.nullValue()));
        }

        @Test
        @DisplayName("★ photoCount는 커밋된 것만 센다 — PENDING은 아직 사진이 아니다")
        void 커밋된_것만_센다() throws Exception {
            savePhoto(PhotoStatus.COMMITTED);
            savePhoto(PhotoStatus.COMMITTED);
            savePhoto(PhotoStatus.PENDING);

            mockMvc.perform(get("/api/albums").with(as(member)))
                    .andExpect(jsonPath("$.data.items[0].photoCount").value(2));
        }

        @Test
        @DisplayName("행사일이 최근인 앨범이 위다")
        void 정렬() throws Exception {
            albumRepository.saveAndFlush(Album.builder()
                    .title("옛날").eventDate(LocalDate.of(2025, 1, 1)).build());
            albumRepository.saveAndFlush(Album.builder()
                    .title("최근").eventDate(LocalDate.of(2026, 12, 25)).build());

            mockMvc.perform(get("/api/albums").with(as(member)))
                    .andExpect(jsonPath("$.data.items[0].title").value("최근"))
                    .andExpect(jsonPath("$.data.items[2].title").value("옛날"));
        }

        @Test
        @DisplayName("★ 삭제하면 사진 행과 R2 객체가 모두 사라진다 — PENDING까지")
        void 삭제() throws Exception {
            savePhoto(PhotoStatus.COMMITTED);
            savePhoto(PhotoStatus.PENDING);   // 브라우저가 올렸는데 커밋을 못 불렀을 수 있다

            mockMvc.perform(delete("/api/albums/" + album.getId()).with(as(leader)))
                    .andExpect(status().isNoContent());

            @SuppressWarnings("unchecked")
            ArgumentCaptor<Collection<String>> keys = ArgumentCaptor.forClass(Collection.class);
            verify(r2Client).deleteAll(keys.capture());
            assertThat(keys.getValue()).hasSize(4);   // 2장 × (view + thumb)

            assertThat(albumRepository.count()).isZero();
            assertThat(photoRepository.count()).isZero();
        }

        @Test
        @DisplayName("대표 사진이 있어도 삭제된다 — FK 참조를 먼저 끊는다")
        void 대표사진이_있어도_삭제() throws Exception {
            Photo cover = savePhoto(PhotoStatus.COMMITTED);
            album.setCoverPhotoIfAbsent(cover);
            albumRepository.saveAndFlush(album);

            mockMvc.perform(delete("/api/albums/" + album.getId()).with(as(leader)))
                    .andExpect(status().isNoContent());

            assertThat(albumRepository.count()).isZero();
        }

        @Test
        @DisplayName("없는 앨범 삭제는 404")
        void 없는_앨범() throws Exception {
            mockMvc.perform(delete("/api/albums/999999").with(as(leader)))
                    .andExpect(status().isNotFound());
        }
    }

    // ── §6.4 커서 페이징 ─────────────────────────────────────

    @Nested
    @DisplayName("사진 목록 (커서)")
    class Photos {

        @Test
        @DisplayName("★ PENDING은 목록에 없다 — 그리드에 깨진 이미지가 뜬다")
        void 커밋된_것만() throws Exception {
            savePhoto(PhotoStatus.COMMITTED);
            savePhoto(PhotoStatus.PENDING);

            mockMvc.perform(get("/api/albums/" + album.getId() + "/photos").with(as(member)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.items.length()").value(1));
        }

        @Test
        @DisplayName("★ 커서로 이어 받으면 빠지거나 겹치는 사진이 없다")
        void 커서로_전부_받는다() throws Exception {
            List<Long> saved = new ArrayList<>();
            for (int i = 0; i < 25; i++) {
                saved.add(savePhoto(PhotoStatus.COMMITTED).getId());
            }

            List<String> seen = new ArrayList<>();
            String cursor = null;
            for (int page = 0; page < 10; page++) {
                var request = get("/api/albums/" + album.getId() + "/photos")
                        .param("size", "10").with(as(member));
                if (cursor != null) {
                    request = request.param("cursor", cursor);
                }
                String body = mockMvc.perform(request)
                        .andExpect(status().isOk())
                        .andReturn().getResponse().getContentAsString();

                var data = objectMapper.readTree(body).path("data");
                data.path("items").forEach(item -> seen.add(item.path("id").asText()));

                if (!data.path("hasNext").asBoolean()) {
                    // 마지막 페이지면 커서가 null이어야 한다 (§1.1)
                    assertThat(data.path("nextCursor").isNull()).isTrue();
                    break;
                }
                cursor = data.path("nextCursor").asText();
            }

            assertThat(seen).hasSize(25).doesNotHaveDuplicates();
            assertThat(seen).containsExactlyElementsOf(
                    saved.stream().map(String::valueOf).toList());
        }

        @Test
        @DisplayName("마지막 페이지는 hasNext=false · nextCursor=null")
        void 마지막_페이지() throws Exception {
            savePhoto(PhotoStatus.COMMITTED);

            mockMvc.perform(get("/api/albums/" + album.getId() + "/photos").with(as(member)))
                    .andExpect(jsonPath("$.data.hasNext").value(false))
                    .andExpect(jsonPath("$.data.nextCursor")
                            .value(org.hamcrest.Matchers.nullValue()));
        }

        @Test
        @DisplayName("⚠️ 망가진 커서는 400이다 — 조용히 처음부터 주면 무한 스크롤이 끝나지 않는다")
        void 잘못된_커서() throws Exception {
            mockMvc.perform(get("/api/albums/" + album.getId() + "/photos")
                            .param("cursor", "!!!not-base64!!!").with(as(member)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.field").value("cursor"));
        }

        @Test
        @DisplayName("thumbUrl·viewUrl이 따로 나온다 — 그리드는 thumb만 쓴다")
        void 두_주소() throws Exception {
            savePhoto(PhotoStatus.COMMITTED);

            mockMvc.perform(get("/api/albums/" + album.getId() + "/photos").with(as(member)))
                    .andExpect(jsonPath("$.data.items[0].thumbUrl").value(PRESIGNED))
                    .andExpect(jsonPath("$.data.items[0].viewUrl").value(PRESIGNED))
                    .andExpect(jsonPath("$.data.items[0].width").value(2560));
        }

        @Test
        @DisplayName("⚠️ R2 키가 응답에 새지 않는다 — 버킷 구조가 드러난다")
        void 키가_새지_않는다() throws Exception {
            savePhoto(PhotoStatus.COMMITTED);

            String body = mockMvc.perform(
                            get("/api/albums/" + album.getId() + "/photos").with(as(member)))
                    .andReturn().getResponse().getContentAsString();

            assertThat(body).doesNotContain("albums/").doesNotContain("r2Key");
        }

        @Test
        @DisplayName("없는 앨범은 404")
        void 없는_앨범() throws Exception {
            mockMvc.perform(get("/api/albums/999999/photos").with(as(member)))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("사진이 없으면 빈 배열이다 — 404가 아니다")
        void 빈_앨범() throws Exception {
            mockMvc.perform(get("/api/albums/" + album.getId() + "/photos").with(as(member)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.items").isEmpty());
        }
    }

    // ── 보조 ─────────────────────────────────────────────────

    private Photo savePhoto(PhotoStatus status) {
        Photo photo = photoRepository.saveAndFlush(Photo.builder()
                .album(album)
                .r2KeyView("albums/x/view")
                .r2KeyThumb("albums/x/thumb")
                .width(2560).height(1707)
                .sizeBytes(status == PhotoStatus.COMMITTED ? 1_000_000 : 0)
                .status(status)
                .build());
        photo.assignKeys("albums/%d/%d-view.webp".formatted(album.getId(), photo.getId()),
                "albums/%d/%d-thumb.webp".formatted(album.getId(), photo.getId()));
        return photoRepository.saveAndFlush(photo);
    }

    private RequestPostProcessor as(Member actor) {
        AuthPrincipal principal = new AuthPrincipal(actor.getId(), actor.getRole());
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities());
        return authentication(authentication);
    }
}
