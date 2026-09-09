package kr.light.attachment;

import kr.light.auth.AuthPrincipal;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import kr.light.member.Role;
import kr.light.post.Post;
import kr.light.post.PostCategory;
import kr.light.post.PostRepository;
import kr.light.storage.R2Client;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 게시물 첨부 (SPEC_API.md §4).
 *
 * <p><b>★ 이 기능의 핵심은 §4.2의 권한 상속이다.</b> 첨부의 열람 권한은 원글의
 * 권한이고, "파일 주소를 아는 것만으로 열려서는 안 된다". 예산안 첨부가
 * 회의록 규칙으로 열리면 헌금·지출 내역이 새어나간다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AttachmentApiTest {

    @Autowired MockMvc mockMvc;
    @Autowired AttachmentRepository attachmentRepository;
    @Autowired AttachmentService attachmentService;
    @Autowired PostRepository postRepository;
    @Autowired MemberRepository memberRepository;
    @Autowired JdbcTemplate jdbcTemplate;

    @MockitoBean R2Client r2Client;

    private Member leader;

    @BeforeEach
    void setUp() {
        attachmentRepository.deleteAllInBatch();
        postRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();

        given(r2Client.presignedDownloadUrl(anyString(), anyString()))
                .willReturn("https://r2.example/download?X-Amz-Signature=stub");

        leader = memberRepository.saveAndFlush(Member.builder()
                .name("시드임원").loginId("leader").role(Role.LEADER).build());
    }

    // ── §4.1 업로드 ──────────────────────────────────────────

    @Nested
    @DisplayName("업로드")
    class Upload {

        @Test
        @DisplayName("올리면 201과 id·filename·sizeBytes가 온다")
        void 업로드() throws Exception {
            mockMvc.perform(upload("신청서.xlsx", "내용".getBytes()))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.data.id").isString())
                    .andExpect(jsonPath("$.data.filename").value("신청서.xlsx"))
                    .andExpect(jsonPath("$.data.sizeBytes").isNumber());

            assertThat(attachmentRepository.count()).isEqualTo(1);
        }

        @Test
        @DisplayName("★ 어느 글에도 연결되지 않은 채 만들어진다 — 글 저장 때 연결된다")
        void 미연결로_생긴다() throws Exception {
            mockMvc.perform(upload("문서.pdf", "x".getBytes())).andExpect(status().isCreated());

            assertThat(attachmentRepository.findAll()).singleElement().satisfies(a -> {
                assertThat(a.getPost()).isNull();
                assertThat(a.getBulletin()).isNull();
            });
        }

        @Test
        @DisplayName("★ 파일명에서 경로 요소를 걷어낸다 — R2 키가 엉뚱한 곳을 가리킨다")
        void 경로_탈출_차단() throws Exception {
            mockMvc.perform(upload("../../etc/passwd", "x".getBytes()))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.data.filename").value("passwd"));

            assertThat(attachmentRepository.findAll()).singleElement().satisfies(a ->
                    assertThat(a.getR2Key())
                            .doesNotContain("..")
                            .matches("attachments/\\d+/passwd"));
        }

        @Test
        @DisplayName("파일이 없으면 400")
        void 빈_파일() throws Exception {
            mockMvc.perform(multipart("/api/attachments").with(as(leader)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.field").value("file"));
        }
    }

    // ── §4.2 권한 상속 ───────────────────────────────────────

    /**
     * §10 매트릭스의 {@code GET /files/{id}} 세 행.
     *
     * <p>⚠️ §4.2 본문은 "대부분의 첨부는 익명도 받을 수 있다"고 적고 있는데
     * <b>그건 공개 열람 시절의 서술</b>이다. 매트릭스가 기준이고, 실제 판단은
     * {@code PostQueryService}가 한다 — 첨부가 규칙을 따로 갖지 않는 것이
     * 이 설계의 요점이다.
     */
    static Stream<Arguments> inheritance() {
        return Stream.of(
                // 분류,                          역할,        기대 상태
                arguments(PostCategory.NOTICE_PUBLIC, null,        302),
                arguments(PostCategory.NOTICE_PUBLIC, Role.MEMBER, 302),

                arguments(PostCategory.NOTICE_MEMBER, null,        401),
                arguments(PostCategory.NOTICE_MEMBER, Role.MEMBER, 302),

                arguments(PostCategory.MINUTES,       null,        401),
                arguments(PostCategory.MINUTES,       Role.MEMBER, 302),

                // ★ 예산안은 403이 아니라 404다 — 존재를 숨긴다
                arguments(PostCategory.BUDGET,        null,        404),
                arguments(PostCategory.BUDGET,        Role.MEMBER, 404),
                arguments(PostCategory.BUDGET,        Role.LEADER, 302)
        );
    }

    @ParameterizedTest(name = "GET files (원글 {0}) × {1} → {2}")
    @MethodSource("inheritance")
    void 원글_권한을_상속한다(PostCategory category, Role role, int expectedStatus) throws Exception {
        Long attachmentId = attachmentOn(category);

        mockMvc.perform(withRole(get("/api/files/" + attachmentId), role))
                .andExpect(status().is(expectedStatus));
    }

    @Test
    @DisplayName("★ 예산안 첨부는 회원에게 404다 — 403을 주면 그 파일이 있다는 게 샌다")
    void 예산안은_존재를_숨긴다() throws Exception {
        Long attachmentId = attachmentOn(PostCategory.BUDGET);

        String body = mockMvc.perform(withRole(get("/api/files/" + attachmentId), Role.MEMBER))
                .andExpect(status().isNotFound())
                .andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain("예산").doesNotContain("X-Amz");
    }

    @Test
    @DisplayName("아직 글에 연결되지 않은 첨부는 404")
    void 미연결_첨부() throws Exception {
        Attachment orphan = attachmentRepository.saveAndFlush(Attachment.builder()
                .r2Key("attachments/1/x.pdf").filename("x.pdf").sizeBytes(10).sortOrder(0).build());

        mockMvc.perform(withRole(get("/api/files/" + orphan.getId()), Role.LEADER))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("없는 첨부는 404")
    void 없는_첨부() throws Exception {
        mockMvc.perform(withRole(get("/api/files/999999"), Role.LEADER))
                .andExpect(status().isNotFound());
    }

    // ── 미연결 정리 배치 (§4.1) ──────────────────────────────

    @Test
    @DisplayName("★ 24시간 지난 미연결 첨부는 행과 R2 객체가 함께 사라진다")
    void 고아_정리() {
        Attachment orphan = attachmentRepository.saveAndFlush(Attachment.builder()
                .r2Key("attachments/1/x.pdf").filename("x.pdf").sizeBytes(10).sortOrder(0).build());
        backdate(orphan.getId(), Instant.now().minus(25, ChronoUnit.HOURS));

        attachmentService.cleanUpOrphans();

        verify(r2Client).deleteAll(org.mockito.ArgumentMatchers.any());
        assertThat(attachmentRepository.count()).isZero();
    }

    @Test
    @DisplayName("★ 글에 연결된 첨부는 아무리 오래돼도 지우지 않는다")
    void 연결된_것은_안_지운다() throws Exception {
        Long id = attachmentOn(PostCategory.NOTICE_PUBLIC);
        backdate(id, Instant.now().minus(365, ChronoUnit.DAYS));

        attachmentService.cleanUpOrphans();

        assertThat(attachmentRepository.count()).isEqualTo(1);
        verify(r2Client, never()).deleteAll(org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("아직 24시간이 안 된 미연결은 둔다 — 글을 쓰는 중일 수 있다")
    void 최근_미연결은_둔다() {
        attachmentRepository.saveAndFlush(Attachment.builder()
                .r2Key("attachments/1/x.pdf").filename("x.pdf").sizeBytes(10).sortOrder(0).build());

        attachmentService.cleanUpOrphans();

        assertThat(attachmentRepository.count()).isEqualTo(1);
    }

    // ── 보조 ─────────────────────────────────────────────────

    private MockHttpServletRequestBuilder upload(String filename, byte[] content) {
        return multipart("/api/attachments")
                .file(new MockMultipartFile("file", filename, "application/octet-stream", content))
                .with(as(leader));
    }

    /** 해당 분류의 글에 연결된 첨부를 만들고 id를 준다 */
    private Long attachmentOn(PostCategory category) {
        Post post = postRepository.saveAndFlush(Post.builder()
                .category(category)
                .title("첨부가 달린 글")
                .slug("slug-" + category.name().toLowerCase() + "-" + System.nanoTime())
                .body("{\"blocks\":[]}")
                .pinned(false)
                .publishedAt(Instant.now().minusSeconds(3600))
                .build());

        return attachmentRepository.saveAndFlush(Attachment.builder()
                .post(post)
                .r2Key("attachments/1/파일.pdf")
                .filename("파일.pdf")
                .sizeBytes(100)
                .sortOrder(0)
                .build()).getId();
    }

    /** {@code created_at}은 {@code updatable = false}라 DB에서 직접 옮긴다 */
    private void backdate(Long attachmentId, Instant createdAt) {
        jdbcTemplate.update("UPDATE attachments SET created_at = ? WHERE id = ?",
                Timestamp.from(createdAt), attachmentId);
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

    private RequestPostProcessor as(Member actor) {
        AuthPrincipal principal = new AuthPrincipal(actor.getId(), actor.getRole());
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities());
        return authentication(authentication);
    }
}
