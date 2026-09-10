package kr.light.photo;

import com.fasterxml.jackson.databind.ObjectMapper;
import kr.light.album.Album;
import kr.light.album.AlbumRepository;
import kr.light.auth.AuthPrincipal;
import kr.light.common.AuditLogRepository;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import kr.light.member.Role;
import kr.light.storage.R2Client;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
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
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.Map;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 사진 신고·삭제 요청 (SPEC_API.md §6.10).
 *
 * <p>초상권 대응이다. 무게가 실린 곳이 둘 있다:
 * <ul>
 *   <li><b>사진이 지워지지 않는다</b> — 신고만으로 지워지면 아무나 남의 사진을 내린다</li>
 *   <li><b>기록이 남는다</b> — 알림 발송이 아직 없어서, 감사 로그가 사라지면
 *       요청 자체가 사라진다</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PhotoReportApiTest {

    @Autowired MockMvc mockMvc;
    @Autowired PhotoRepository photoRepository;
    @Autowired AlbumRepository albumRepository;
    @Autowired MemberRepository memberRepository;
    @Autowired AuditLogRepository auditLogRepository;
    @Autowired ObjectMapper objectMapper;

    @MockitoBean R2Client r2Client;

    private Member member;
    private Photo photo;

    @BeforeEach
    void setUp() {
        auditLogRepository.deleteAllInBatch();
        photoRepository.deleteAllInBatch();
        albumRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();

        member = memberRepository.saveAndFlush(Member.builder()
                .name("시드회원").loginId("member").role(Role.MEMBER).build());
        Album album = albumRepository.saveAndFlush(Album.builder().title("수련회").build());
        photo = photoRepository.saveAndFlush(Photo.builder()
                .album(album)
                .r2KeyView("albums/1/1-view.webp")
                .r2KeyThumb("albums/1/1-thumb.webp")
                .sizeBytes(1_000)
                .status(PhotoStatus.COMMITTED)
                .build());
    }

    @Test
    @DisplayName("★ 신고해도 사진이 지워지지 않는다 — 아무나 남의 사진을 내릴 수 있게 된다")
    void 사진은_남는다() throws Exception {
        mockMvc.perform(report(photo.getId(), "본인 사진 삭제 요청합니다"))
                .andExpect(status().isNoContent());

        assertThat(photoRepository.findById(photo.getId())).isPresent();
    }

    @Test
    @DisplayName("★ 감사 로그에 남는다 — 알림이 없어서 이 기록이 사라지면 요청도 사라진다")
    void 기록이_남는다() throws Exception {
        mockMvc.perform(report(photo.getId(), "제 얼굴이 나온 사진입니다"))
                .andExpect(status().isNoContent());

        assertThat(auditLogRepository.findAll()).singleElement().satisfies(log -> {
            assertThat(log.getAction()).isEqualTo("PHOTO_REPORT");
            assertThat(log.getTarget()).isEqualTo("photo:" + photo.getId());
            // 사유가 곧 요청의 내용이다 — 잘리거나 사라지면 임원이 판단할 수 없다
            assertThat(log.getDetail()).isEqualTo("제 얼굴이 나온 사진입니다");
            assertThat(log.getActor().getId()).isEqualTo(member.getId());
        });
    }

    @Test
    @DisplayName("사유가 비면 400 — field는 reason이다 (FE가 그 필드에 오류를 붙인다)")
    void 빈_사유() throws Exception {
        mockMvc.perform(report(photo.getId(), "   "))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.field").value("reason"));
    }

    @Test
    @DisplayName("1000자를 넘으면 400 — FE 폼과 같은 상한이다")
    void 너무_긴_사유() throws Exception {
        mockMvc.perform(report(photo.getId(), "가".repeat(1001)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.field").value("reason"));
    }

    @Test
    @DisplayName("없는 사진은 404")
    void 없는_사진() throws Exception {
        mockMvc.perform(report(999999L, "삭제 요청"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("커밋되지 않은 사진도 404 — 아직 R2에 없을 수 있고 존재를 알릴 이유도 없다")
    void 미커밋_사진() throws Exception {
        Photo pending = photoRepository.saveAndFlush(Photo.builder()
                .album(photo.getAlbum())
                .r2KeyView("x").r2KeyThumb("y")
                .sizeBytes(0).status(PhotoStatus.PENDING)
                .build());

        mockMvc.perform(report(pending.getId(), "삭제 요청"))
                .andExpect(status().isNotFound());
    }

    // ── 인가 (§10 · 2026-09-04 G→M) ──────────────────────────

    static Stream<Arguments> roles() {
        return Stream.of(
                // ★ 익명은 사진 id를 알아낼 경로가 없어 열어둬도 쓸 수 없었다
                arguments(null,        401, "UNAUTHORIZED"),
                arguments(Role.MEMBER, 204, null),
                arguments(Role.LEADER, 204, null),
                arguments(Role.PASTOR, 204, null)
        );
    }

    @ParameterizedTest(name = "POST photo report × {0} → {1}")
    @MethodSource("roles")
    void 인가(Role role, int expectedStatus, String expectedCode) throws Exception {
        var request = post("/api/photos/" + photo.getId() + "/report")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("reason", "삭제 요청")));

        var result = mockMvc.perform(withRole(request, role))
                .andExpect(status().is(expectedStatus));

        if (expectedCode != null) {
            result.andExpect(jsonPath("$.error.code").value(expectedCode));
        }
    }

    // ── 보조 ─────────────────────────────────────────────────

    private MockHttpServletRequestBuilder report(Long photoId, String reason) throws Exception {
        return post("/api/photos/" + photoId + "/report")
                .with(as(member))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("reason", reason)));
    }

    private MockHttpServletRequestBuilder withRole(MockHttpServletRequestBuilder builder, Role role) {
        if (role == null) {
            return builder;
        }
        Member actor = memberRepository.saveAndFlush(Member.builder()
                .name("행위자")
                .loginId("actor_%s".formatted(role.name().toLowerCase()))
                .role(role)
                .build());
        return builder.with(as(actor));
    }

    private RequestPostProcessor as(Member actor) {
        AuthPrincipal principal = new AuthPrincipal(actor.getId(), actor.getRole());
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities());
        return authentication(authentication);
    }
}
