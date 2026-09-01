package kr.light.post;

import com.fasterxml.jackson.databind.ObjectMapper;
import kr.light.attachment.Attachment;
import kr.light.attachment.AttachmentRepository;
import kr.light.auth.AuthPrincipal;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import kr.light.member.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 게시물 작성·수정·삭제의 실제 동작 (SPEC_API.md §3.4 · §3.5).
 *
 * <p>인가는 {@link PostWriteAuthorizationTest}가 덮는다. 여기서는 임원으로
 * 로그인한 뒤 <b>무엇이 실제로 바뀌는가</b>를 본다 — slug 생성, 임시저장,
 * 게시일 유지, 첨부 연결.
 *
 * <p>⚠️ 이름에 {@code Authorization}을 넣지 않았다. 인가 매트릭스가 아니다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PostWriteApiTest {

    @Autowired MockMvc mockMvc;
    @Autowired PostRepository postRepository;
    @Autowired AttachmentRepository attachmentRepository;
    @Autowired MemberRepository memberRepository;
    @Autowired ObjectMapper objectMapper;

    private Member leader;

    @BeforeEach
    void setUp() {
        attachmentRepository.deleteAllInBatch();
        postRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();

        leader = memberRepository.saveAndFlush(Member.builder()
                .name("박도연").loginId("leader").role(Role.LEADER).build());
    }

    // ── 작성 (§3.4) ───────────────────────────────────────────

    @Test
    @DisplayName("작성하면 201과 id가 나오고 목록에 보인다")
    void 작성() throws Exception {
        mockMvc.perform(write(form("여름 수련회 신청 안내", PostCategory.NOTICE_PUBLIC, true)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").isString());

        mockMvc.perform(get("/api/posts").param("category", "NOTICE_PUBLIC"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].title").value("여름 수련회 신청 안내"))
                .andExpect(jsonPath("$.data.items[0].authorName").value("박도연"));
    }

    @Test
    @DisplayName("공개 공지의 slug를 제목에서 만든다 — 한글 그대로")
    void slug_생성() throws Exception {
        mockMvc.perform(write(form("여름 수련회 신청 안내", PostCategory.NOTICE_PUBLIC, true)))
                .andExpect(status().isCreated());

        assertThat(postRepository.findAll().get(0).getSlug())
                .isEqualTo("여름-수련회-신청-안내");

        // 그 slug로 상세가 열린다 (FE의 /news/[slug])
        mockMvc.perform(get("/api/posts/여름-수련회-신청-안내"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("여름 수련회 신청 안내"));
    }

    @Test
    @DisplayName("제목이 같으면 slug에 -2가 붙는다")
    void slug_중복() throws Exception {
        mockMvc.perform(write(form("공지", PostCategory.NOTICE_PUBLIC, true)))
                .andExpect(status().isCreated());
        mockMvc.perform(write(form("공지", PostCategory.NOTICE_PUBLIC, true)))
                .andExpect(status().isCreated());

        assertThat(postRepository.findAll())
                .extracting(Post::getSlug)
                .containsExactlyInAnyOrder("공지", "공지-2");
    }

    @Test
    @DisplayName("URL을 깨는 문자는 slug에서 빠진다")
    void slug_특수문자() throws Exception {
        mockMvc.perform(write(form("8월 정기모임 (수정)? #긴급", PostCategory.NOTICE_PUBLIC, true)))
                .andExpect(status().isCreated());

        String slug = postRepository.findAll().get(0).getSlug();
        assertThat(slug).doesNotContain("?", "#", "(", ")");
        assertThat(slug).isEqualTo("8월-정기모임-수정-긴급");
    }

    @Test
    @DisplayName("★ 공개 공지가 아니면 slug가 null이다 — unique 제약 때문")
    void 비공개는_slug가_없다() throws Exception {
        // 빈 문자열을 넣으면 posts_slug_uk 때문에 두 번째 글부터 저장이 깨진다
        mockMvc.perform(write(form("8월 회의록", PostCategory.MINUTES, true)))
                .andExpect(status().isCreated());
        mockMvc.perform(write(form("9월 회의록", PostCategory.MINUTES, true)))
                .andExpect(status().isCreated());

        assertThat(postRepository.findAll())
                .extracting(Post::getSlug)
                .containsOnlyNulls();
    }

    @Test
    @DisplayName("publish=false면 임시저장이라 목록에 나오지 않는다")
    void 임시저장() throws Exception {
        mockMvc.perform(write(form("작성 중", PostCategory.NOTICE_PUBLIC, false)))
                .andExpect(status().isCreated());

        assertThat(postRepository.findAll().get(0).getPublishedAt()).isNull();

        mockMvc.perform(get("/api/posts").param("category", "NOTICE_PUBLIC"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items").isEmpty());
    }

    @Test
    @DisplayName("body가 JSON이 아니면 400 — 저장 자체를 막는다")
    void 깨진_body() throws Exception {
        // 문자열로 받았다면 그대로 저장되고 나중에 상세 조회가 통째로 500이 된다
        mockMvc.perform(post("/api/posts").with(as(leader))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"category":"NOTICE_PUBLIC","title":"제목",
                                 "body":"이건 JSON이 아니다","pinned":false,"publish":true}"""))
                .andExpect(status().isBadRequest());

        assertThat(postRepository.count()).isZero();
    }

    @Test
    @DisplayName("제목이 없으면 400")
    void 제목_필수() throws Exception {
        Map<String, Object> body = form("제목", PostCategory.NOTICE_PUBLIC, true);
        body.put("title", "  ");

        mockMvc.perform(write(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.field").value("title"));
    }

    // ── 수정 (§3.5) ───────────────────────────────────────────

    @Test
    @DisplayName("수정하면 제목·본문이 바뀐다")
    void 수정() throws Exception {
        String id = createAndGetId(form("원래 제목", PostCategory.NOTICE_PUBLIC, true));

        Map<String, Object> edited = form("고친 제목", PostCategory.NOTICE_PUBLIC, true);
        mockMvc.perform(put("/api/posts/" + id).with(as(leader))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(edited)))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/posts/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("고친 제목"));
    }

    @Test
    @DisplayName("★ 이미 게시된 글을 다시 저장해도 게시일이 바뀌지 않는다")
    void 게시일_유지() throws Exception {
        String id = createAndGetId(form("공지", PostCategory.NOTICE_PUBLIC, true));
        var published = postRepository.findById(Long.valueOf(id)).orElseThrow().getPublishedAt();

        Thread.sleep(10);
        mockMvc.perform(put("/api/posts/" + id).with(as(leader))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(form("오타 고침", PostCategory.NOTICE_PUBLIC, true))))
                .andExpect(status().isNoContent());

        // 오타를 고쳤다고 목록 맨 위로 올라오면 안 된다
        assertThat(postRepository.findById(Long.valueOf(id)).orElseThrow().getPublishedAt())
                .isEqualTo(published);
    }

    @Test
    @DisplayName("임시저장 글을 게시로 올릴 수 있고, 반대로 내릴 수도 있다")
    void 게시_전환() throws Exception {
        String id = createAndGetId(form("초안", PostCategory.NOTICE_PUBLIC, false));

        // 임시저장 → 게시
        mockMvc.perform(put("/api/posts/" + id).with(as(leader))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(form("초안", PostCategory.NOTICE_PUBLIC, true))))
                .andExpect(status().isNoContent());
        assertThat(postRepository.findById(Long.valueOf(id)).orElseThrow().isPublished()).isTrue();

        // 게시 → 임시저장 (잘못 올린 글을 내리는 수단이 삭제뿐이면 너무 거칠다)
        mockMvc.perform(put("/api/posts/" + id).with(as(leader))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(form("초안", PostCategory.NOTICE_PUBLIC, false))))
                .andExpect(status().isNoContent());
        assertThat(postRepository.findById(Long.valueOf(id)).orElseThrow().isPublished()).isFalse();
    }

    @Test
    @DisplayName("임시저장 글도 수정할 수 있다 — 이어서 쓰는 흐름")
    void 임시저장_수정() throws Exception {
        String id = createAndGetId(form("초안", PostCategory.NOTICE_PUBLIC, false));

        mockMvc.perform(put("/api/posts/" + id).with(as(leader))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(form("이어서 씀", PostCategory.NOTICE_PUBLIC, false))))
                .andExpect(status().isNoContent());

        assertThat(postRepository.findById(Long.valueOf(id)).orElseThrow().getTitle())
                .isEqualTo("이어서 씀");
    }

    @Test
    @DisplayName("작성자는 바뀌지 않는다 — 다른 임원이 고쳐도")
    void 작성자_유지() throws Exception {
        String id = createAndGetId(form("공지", PostCategory.NOTICE_PUBLIC, true));

        Member other = memberRepository.saveAndFlush(Member.builder()
                .name("다른임원").loginId("other").role(Role.LEADER).build());

        mockMvc.perform(put("/api/posts/" + id).with(as(other))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(form("고침", PostCategory.NOTICE_PUBLIC, true))))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/posts/" + id))
                .andExpect(jsonPath("$.data.authorName").value("박도연"));
    }

    @Test
    @DisplayName("없는 글을 수정하면 404")
    void 없는_글_수정() throws Exception {
        mockMvc.perform(put("/api/posts/999999").with(as(leader))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(form("제목", PostCategory.NOTICE_PUBLIC, true))))
                .andExpect(status().isNotFound());
    }

    // ── 첨부 연결 (§4.1) ──────────────────────────────────────

    @Test
    @DisplayName("attachmentIds로 첨부가 연결된다")
    void 첨부_연결() throws Exception {
        Attachment orphan = saveOrphanAttachment("신청서.xlsx");

        Map<String, Object> body = form("공지", PostCategory.NOTICE_PUBLIC, true);
        body.put("attachmentIds", List.of(String.valueOf(orphan.getId())));
        String id = createAndGetId(body);

        mockMvc.perform(get("/api/posts/" + id))
                .andExpect(jsonPath("$.data.attachments[0].filename").value("신청서.xlsx"));
    }

    @Test
    @DisplayName("다른 글에 붙은 첨부는 가져올 수 없다 — 원래 글에서 사라진다")
    void 남의_첨부() throws Exception {
        Attachment attachment = saveOrphanAttachment("문서.pdf");
        Map<String, Object> first = form("첫 글", PostCategory.NOTICE_PUBLIC, true);
        first.put("attachmentIds", List.of(String.valueOf(attachment.getId())));
        createAndGetId(first);

        Map<String, Object> second = form("둘째 글", PostCategory.NOTICE_PUBLIC, true);
        second.put("attachmentIds", List.of(String.valueOf(attachment.getId())));

        mockMvc.perform(write(second))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.field").value("attachmentIds"));
    }

    @Test
    @DisplayName("없는 첨부 id는 400")
    void 없는_첨부() throws Exception {
        Map<String, Object> body = form("공지", PostCategory.NOTICE_PUBLIC, true);
        body.put("attachmentIds", List.of("999999"));

        mockMvc.perform(write(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.field").value("attachmentIds"));
    }

    @Test
    @DisplayName("수정에서 첨부를 빼면 연결만 끊긴다 — 행은 남는다")
    void 첨부_해제() throws Exception {
        Attachment attachment = saveOrphanAttachment("문서.pdf");
        Map<String, Object> body = form("공지", PostCategory.NOTICE_PUBLIC, true);
        body.put("attachmentIds", List.of(String.valueOf(attachment.getId())));
        String id = createAndGetId(body);

        mockMvc.perform(put("/api/posts/" + id).with(as(leader))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(form("공지", PostCategory.NOTICE_PUBLIC, true))))
                .andExpect(status().isNoContent());

        // 정리 배치(24시간)가 처리할 몫이라 지우지 않는다
        assertThat(attachmentRepository.findById(attachment.getId())).isPresent();
        assertThat(attachmentRepository.findByPostIdOrderBySortOrderAscIdAsc(Long.valueOf(id)))
                .isEmpty();
    }

    // ── 삭제 (§3.5) ───────────────────────────────────────────

    @Test
    @DisplayName("삭제하면 글과 첨부 행이 함께 사라진다")
    void 삭제() throws Exception {
        Attachment attachment = saveOrphanAttachment("문서.pdf");
        Map<String, Object> body = form("공지", PostCategory.NOTICE_PUBLIC, true);
        body.put("attachmentIds", List.of(String.valueOf(attachment.getId())));
        String id = createAndGetId(body);

        mockMvc.perform(delete("/api/posts/" + id).with(as(leader)))
                .andExpect(status().isNoContent());

        assertThat(postRepository.findById(Long.valueOf(id))).isEmpty();
        // FK ON DELETE CASCADE
        assertThat(attachmentRepository.findById(attachment.getId())).isEmpty();

        mockMvc.perform(get("/api/posts/" + id)).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("없는 글을 삭제하면 404")
    void 없는_글_삭제() throws Exception {
        mockMvc.perform(delete("/api/posts/999999").with(as(leader)))
                .andExpect(status().isNotFound());
    }

    // ── 보조 ──────────────────────────────────────────────────

    private Map<String, Object> form(String title, PostCategory category, boolean publish) {
        Map<String, Object> body = new HashMap<>();
        body.put("category", category.name());
        body.put("title", title);
        body.put("body", Map.of("type", "doc", "content", List.of()));
        body.put("pinned", false);
        body.put("publish", publish);
        return body;
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder write(
            Map<String, Object> body) throws Exception {
        return post("/api/posts").with(as(leader))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(body));
    }

    private String createAndGetId(Map<String, Object> body) throws Exception {
        String response = mockMvc.perform(write(body))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).path("data").path("id").asText();
    }

    private Attachment saveOrphanAttachment(String filename) {
        return attachmentRepository.saveAndFlush(Attachment.builder()
                .r2Key("tmp/" + filename)
                .filename(filename)
                .contentType("application/octet-stream")
                .sizeBytes(1024L)
                .sortOrder(0)
                .build());
    }

    private RequestPostProcessor as(Member member) {
        AuthPrincipal principal = new AuthPrincipal(member.getId(), member.getRole());
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities());
        return authentication(authentication);
    }

    private String json(Map<String, Object> body) throws Exception {
        return objectMapper.writeValueAsString(body);
    }
}
