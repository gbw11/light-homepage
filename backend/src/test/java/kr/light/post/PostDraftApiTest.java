package kr.light.post;

import com.fasterxml.jackson.databind.ObjectMapper;
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

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 임시저장 글 다시 열기 (SPEC_API.md §3.6 · §3.7, 2026-10-07).
 *
 * <p>사용자 흐름 점검 🔴-2 — 임시저장한 글이 목록·상세에서 모두 빠져 수정 화면이
 * 404였다. 이 테스트는 "저장 → 목록에서 찾기 → 수정 화면으로 열기 → 게시하면
 * 목록에서 빠짐"의 왕복을 지킨다. 그리고 <b>공개 경로는 여전히 숨긴다</b>는 것을
 * 함께 확인한다 — 이 기능이 쓰던 글을 공개 주소로 새게 하면 안 된다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PostDraftApiTest {

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

    @Test
    @DisplayName("임시저장 글은 임시저장 목록에 나오고, 게시 글은 나오지 않는다")
    void 목록() throws Exception {
        create(form("쓰던 공지", PostCategory.NOTICE_MEMBER, false));
        create(form("게시한 공지", PostCategory.NOTICE_MEMBER, true));

        mockMvc.perform(get("/api/admin/posts/drafts").with(as(leader)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].title").value("쓰던 공지"))
                .andExpect(jsonPath("$.data.items[0].publishedAt").isEmpty())
                .andExpect(jsonPath("$.data.items[0].authorName").value("박도연"));
    }

    @Test
    @DisplayName("분류를 가리지 않고 모은다 — 예산안 임시저장도 임원에게는 보인다")
    void 분류_무관() throws Exception {
        create(form("공개 초안", PostCategory.NOTICE_PUBLIC, false));
        create(form("예산 초안", PostCategory.BUDGET, false));

        mockMvc.perform(get("/api/admin/posts/drafts").with(as(leader)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(2));
    }

    @Test
    @DisplayName("★ 수정 화면 경로는 임시저장 글을 연다 — 공개 상세는 계속 404")
    void 수정_화면으로_열기() throws Exception {
        String id = create(form("쓰던 공지", PostCategory.NOTICE_PUBLIC, false));

        mockMvc.perform(get("/api/admin/posts/" + id).with(as(leader)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("쓰던 공지"))
                .andExpect(jsonPath("$.data.publishedAt").isEmpty())
                .andExpect(jsonPath("$.data.body.type").value("doc"));

        // 공개 경로로는 여전히 보이지 않는다 — 쓰던 글이 새면 안 된다
        mockMvc.perform(get("/api/posts/" + id).with(as(leader)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("수정 화면 경로는 게시된 글도 연다")
    void 게시글도_열린다() throws Exception {
        String id = create(form("게시한 공지", PostCategory.MINUTES, true));

        mockMvc.perform(get("/api/admin/posts/" + id).with(as(leader)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.publishedAt").isNotEmpty());
    }

    @Test
    @DisplayName("게시하면 임시저장 목록에서 빠지고 공개 목록에 나온다 — 왕복")
    void 게시하면_빠진다() throws Exception {
        String id = create(form("쓰던 공지", PostCategory.NOTICE_MEMBER, false));

        mockMvc.perform(put("/api/posts/" + id).with(as(leader))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(form("쓰던 공지", PostCategory.NOTICE_MEMBER, true))))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/admin/posts/drafts").with(as(leader)))
                .andExpect(jsonPath("$.data.items.length()").value(0));
        mockMvc.perform(get("/api/posts").param("category", "NOTICE_MEMBER").with(as(leader)))
                .andExpect(jsonPath("$.data.items[0].title").value("쓰던 공지"));
    }

    @Test
    @DisplayName("게시 글을 임시저장으로 내리면 임시저장 목록에서 다시 찾을 수 있다")
    void 내린_글을_다시_찾는다() throws Exception {
        String id = create(form("잘못 올린 공지", PostCategory.NOTICE_PUBLIC, true));

        mockMvc.perform(put("/api/posts/" + id).with(as(leader))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(form("잘못 올린 공지", PostCategory.NOTICE_PUBLIC, false))))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/admin/posts/drafts").with(as(leader)))
                .andExpect(jsonPath("$.data.items[0].id").value(id));
    }

    @Test
    @DisplayName("없는 id는 404")
    void 없는_글() throws Exception {
        mockMvc.perform(get("/api/admin/posts/999999").with(as(leader)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
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

    private String create(Map<String, Object> body) throws Exception {
        String response = mockMvc.perform(post("/api/posts").with(as(leader))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(body)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).path("data").path("id").asText();
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
