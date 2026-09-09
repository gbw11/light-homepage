package kr.light.upload;

import com.fasterxml.jackson.databind.ObjectMapper;
import kr.light.album.Album;
import kr.light.album.AlbumRepository;
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

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 사진 업로드 (SPEC_API.md §6.5 · §6.6).
 *
 * <p>이 기능의 어려운 점은 <b>파일이 우리 서버를 통과하지 않는다</b>는 것이다.
 * 브라우저가 R2로 직접 올리므로, 우리는 "실제로 올라갔는지"를 스스로 알 수
 * 없다. 그래서 무게가 <b>커밋 단계의 검증</b>에 실려 있다 — 클라이언트 말을
 * 믿으면 목록에 깨진 이미지가 뜨고 용량 집계가 틀어진다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class UploadApiTest {

    @Autowired MockMvc mockMvc;
    @Autowired AlbumRepository albumRepository;
    @Autowired PhotoRepository photoRepository;
    @Autowired MemberRepository memberRepository;
    @Autowired ObjectMapper objectMapper;

    @MockitoBean R2Client r2Client;

    private Member leader;
    private Album album;

    @BeforeEach
    void setUp() {
        photoRepository.deleteAllInBatch();
        albumRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();

        given(r2Client.presignedPutUrl(anyString(), anyString(), org.mockito.ArgumentMatchers.any()))
                .willReturn("https://r2.example/put?X-Amz-Signature=stub");
        given(r2Client.presignedGetUrl(anyString()))
                .willReturn("https://r2.example/get?X-Amz-Signature=stub");

        leader = memberRepository.saveAndFlush(Member.builder()
                .name("시드임원").loginId("leader").role(Role.LEADER).build());
        album = albumRepository.saveAndFlush(Album.builder().title("2026 여름수련회").build());
    }

    // ── §6.5 발급 ────────────────────────────────────────────

    @Nested
    @DisplayName("URL 발급")
    class Issue {

        @Test
        @DisplayName("장당 PUT URL 2개(view·thumb)와 photoId가 온다")
        void 발급() throws Exception {
            mockMvc.perform(issue(file("f1"), file("f2")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.uploads.length()").value(2))
                    .andExpect(jsonPath("$.data.uploads[0].clientId").value("f1"))
                    .andExpect(jsonPath("$.data.uploads[0].photoId").isString())
                    .andExpect(jsonPath("$.data.uploads[0].viewPutUrl").isString())
                    .andExpect(jsonPath("$.data.uploads[0].thumbPutUrl").isString())
                    .andExpect(jsonPath("$.data.uploads[0].expiresIn").value(900));
        }

        @Test
        @DisplayName("★ 행은 PENDING으로 생기고 size_bytes는 0이다 — 올리지도 않은 용량을 세지 않는다")
        void pending으로_생긴다() throws Exception {
            mockMvc.perform(issue(file("f1"))).andExpect(status().isOk());

            assertThat(photoRepository.findAll()).singleElement().satisfies(photo -> {
                assertThat(photo.getStatus()).isEqualTo(PhotoStatus.PENDING);
                // 클라이언트가 말한 크기를 넣으면, 업로드가 실패해도 그 용량이
                // 집계에 잡혀 "쓰지도 않은 공간"이 한도를 먹는다
                assertThat(photo.getSizeBytes()).isZero();
                assertThat(photo.getR2KeyView()).isNotBlank();
                assertThat(photo.getR2KeyThumb()).isNotBlank();
            });
        }

        @Test
        @DisplayName("★ R2 키를 서버가 만든다 — 사용자가 준 값이 섞이지 않는다")
        void 키를_서버가_만든다() throws Exception {
            mockMvc.perform(issue(file("../../etc/passwd"))).andExpect(status().isOk());

            assertThat(photoRepository.findAll()).singleElement().satisfies(photo -> {
                assertThat(photo.getR2KeyView())
                        .doesNotContain("..")
                        .matches("albums/\\d+/\\d+-view\\.webp");
                assertThat(photo.getR2KeyThumb()).matches("albums/\\d+/\\d+-thumb\\.webp");
            });
        }

        @Test
        @DisplayName("없는 앨범은 404")
        void 없는_앨범() throws Exception {
            var body = Map.of("albumId", "999999", "files", List.of(fileMap("f1")));
            mockMvc.perform(post("/api/uploads:issue").with(as(leader))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("파일 목록이 비면 400")
        void 빈_목록() throws Exception {
            var body = Map.of("albumId", String.valueOf(album.getId()), "files", List.of());
            mockMvc.perform(post("/api/uploads:issue").with(as(leader))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isBadRequest());
        }
    }

    // ── §6.6 확정 ────────────────────────────────────────────

    @Nested
    @DisplayName("확정")
    class Commit {

        @Test
        @DisplayName("★ R2에 실제로 있는 것만 확정된다 — 클라이언트 말을 믿지 않는다")
        void 실제_존재를_확인한다() throws Exception {
            String photoId = issueOne("f1");

            // R2에 아무것도 없다 — 브라우저가 올리지 않았거나 실패했다
            given(r2Client.objectSize(anyString())).willReturn(Optional.empty());

            mockMvc.perform(commit(photoId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.committed").isEmpty())
                    .andExpect(jsonPath("$.data.failed[0].photoId").value(photoId))
                    .andExpect(jsonPath("$.data.failed[0].reason").value("OBJECT_NOT_FOUND"));

            assertThat(photoRepository.findById(Long.valueOf(photoId)).orElseThrow()
                    .getStatus()).isEqualTo(PhotoStatus.PENDING);
        }

        @Test
        @DisplayName("★ size_bytes는 R2 실측값이다 — view + thumb 합계")
        void 실측_크기를_기록한다() throws Exception {
            String photoId = issueOne("f1");
            given(r2Client.objectSize(anyString())).willReturn(Optional.of(1_000_000L));

            mockMvc.perform(commit(photoId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.committed[0]").value(photoId));

            Photo photo = photoRepository.findById(Long.valueOf(photoId)).orElseThrow();
            assertThat(photo.getStatus()).isEqualTo(PhotoStatus.COMMITTED);
            assertThat(photo.getSizeBytes()).isEqualTo(2_000_000L);   // view + thumb
        }

        @Test
        @DisplayName("★ 일부 실패는 200이다 — 19장을 다시 올리게 하지 않는다")
        void 일부_실패() throws Exception {
            String ok = issueOne("f1");
            String missing = issueOne("f2");

            Photo okPhoto = photoRepository.findById(Long.valueOf(ok)).orElseThrow();
            given(r2Client.objectSize(anyString())).willReturn(Optional.empty());
            given(r2Client.objectSize(okPhoto.getR2KeyView())).willReturn(Optional.of(10L));
            given(r2Client.objectSize(okPhoto.getR2KeyThumb())).willReturn(Optional.of(5L));

            mockMvc.perform(commit(ok, missing))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.committed[0]").value(ok))
                    .andExpect(jsonPath("$.data.failed[0].photoId").value(missing));
        }

        @Test
        @DisplayName("이미 확정된 것을 다시 보내면 성공으로 본다 — 재시도가 영원히 실패로 남지 않게")
        void 중복_확정() throws Exception {
            String photoId = issueOne("f1");
            given(r2Client.objectSize(anyString())).willReturn(Optional.of(10L));

            mockMvc.perform(commit(photoId)).andExpect(status().isOk());
            mockMvc.perform(commit(photoId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.committed[0]").value(photoId))
                    .andExpect(jsonPath("$.data.failed").isEmpty());
        }

        @Test
        @DisplayName("없는 photoId는 NOT_FOUND로 돌려준다 — 전체를 400으로 만들지 않는다")
        void 없는_사진() throws Exception {
            mockMvc.perform(commit("999999"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.failed[0].reason").value("NOT_FOUND"));
        }

        @Test
        @DisplayName("첫 사진이 앨범 대표가 된다 — 임원이 따로 고르게 하면 빈 칸이 생긴다")
        void 첫_사진이_대표() throws Exception {
            String first = issueOne("f1");
            given(r2Client.objectSize(anyString())).willReturn(Optional.of(10L));
            mockMvc.perform(commit(first)).andExpect(status().isOk());

            Album reloaded = albumRepository.findById(album.getId()).orElseThrow();
            assertThat(reloaded.getCoverPhoto()).isNotNull();
            assertThat(reloaded.getCoverPhoto().getId()).isEqualTo(Long.valueOf(first));
        }
    }

    // ── 보조 ─────────────────────────────────────────────────

    private Map<String, Object> fileMap(String clientId) {
        return Map.of("clientId", clientId, "sizeBytes", 1_250_000, "thumbSizeBytes", 82_000,
                "width", 2560, "height", 1707);
    }

    private Map<String, Object> file(String clientId) {
        return fileMap(clientId);
    }

    @SafeVarargs
    private org.springframework.test.web.servlet.RequestBuilder issue(
            Map<String, Object>... files) throws Exception {
        var body = Map.of("albumId", String.valueOf(album.getId()), "files", List.of(files));
        return post("/api/uploads:issue").with(as(leader))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body));
    }

    private String issueOne(String clientId) throws Exception {
        String body = mockMvc.perform(issue(file(clientId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).path("data").path("uploads").get(0)
                .path("photoId").asText();
    }

    private org.springframework.test.web.servlet.RequestBuilder commit(String... photoIds)
            throws Exception {
        return post("/api/uploads:commit").with(as(leader))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("photoIds", List.of(photoIds))));
    }

    private RequestPostProcessor as(Member actor) {
        AuthPrincipal principal = new AuthPrincipal(actor.getId(), actor.getRole());
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities());
        return authentication(authentication);
    }
}
