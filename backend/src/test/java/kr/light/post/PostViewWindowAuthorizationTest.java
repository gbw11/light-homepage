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
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 회의록 · 예산안 열람 기간 (2026-10-19, V11 · SPEC_API §3).
 *
 * <p>규칙: 기간 안에만 내용(상세 · 첨부)을 본다. 예외는 <b>전도사</b>와 <b>글쓴이</b>.
 * 임원도 기간을 따른다(월례회와 다르다). 기간 밖 글도 목록에는 남는다(잠김).
 *
 * <p>이름에 {@code Authorization}이 들어간다 — Jenkins가 이 패턴으로 늘 돌린다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PostViewWindowAuthorizationTest {

    @Autowired MockMvc mockMvc;
    @Autowired PostRepository postRepository;
    @Autowired AttachmentRepository attachmentRepository;
    @Autowired MemberRepository memberRepository;
    @Autowired ObjectMapper objectMapper;

    Member member;
    Member author;      // 글을 쓴 임원
    Member otherLeader; // 글을 쓰지 않은 임원
    Member pastor;

    static final Instant NOW = Instant.now();
    static final Instant YESTERDAY = NOW.minusSeconds(86_400);
    static final Instant TOMORROW = NOW.plusSeconds(86_400);

    @BeforeEach
    void setUp() {
        attachmentRepository.deleteAllInBatch();
        postRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();
        member = save("회원", "member", Role.MEMBER);
        author = save("글쓴임원", "author", Role.LEADER);
        otherLeader = save("다른임원", "leader2", Role.LEADER);
        pastor = save("전도사", "pastor", Role.PASTOR);
    }

    // ── 상세 ─────────────────────────────────────────────────

    @Nested
    @DisplayName("회의록 상세")
    class MinutesDetail {

        @Test
        @DisplayName("기간 안이면 회원도 본다")
        void 기간안() throws Exception {
            Post post = minutes(YESTERDAY, TOMORROW);

            mockMvc.perform(get("/api/posts/" + post.getId()).with(as(member)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.viewableFrom").isString())
                    .andExpect(jsonPath("$.data.viewableUntil").isString());
        }

        @Test
        @DisplayName("기간이 끝났으면 회원 · 다른 임원은 403 「열람 기간이 아닙니다」 — 404가 아니다")
        void 기간종료() throws Exception {
            Post post = minutes(NOW.minusSeconds(7 * 86_400), YESTERDAY);

            for (Member who : List.of(member, otherLeader)) {
                mockMvc.perform(get("/api/posts/" + post.getId()).with(as(who)))
                        .andExpect(status().isForbidden())
                        .andExpect(jsonPath("$.error.code").value("FORBIDDEN"))
                        .andExpect(jsonPath("$.error.message").value("열람 기간이 아닙니다."));
            }
        }

        @Test
        @DisplayName("기간이 시작 전이어도 403")
        void 시작전() throws Exception {
            Post post = minutes(TOMORROW, TOMORROW.plusSeconds(86_400));

            mockMvc.perform(get("/api/posts/" + post.getId()).with(as(member)))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("기간 밖에도 전도사와 글쓴이는 본다")
        void 전도사_글쓴이() throws Exception {
            Post post = minutes(NOW.minusSeconds(7 * 86_400), YESTERDAY);

            for (Member who : List.of(pastor, author)) {
                mockMvc.perform(get("/api/posts/" + post.getId()).with(as(who)))
                        .andExpect(status().isOk());
            }
        }

        @Test
        @DisplayName("★ 기간이 없는 예전 글(V11 이전)은 잠김 — 전도사만 연다")
        void 예전글() throws Exception {
            Post post = minutes(null, null);

            mockMvc.perform(get("/api/posts/" + post.getId()).with(as(member)))
                    .andExpect(status().isForbidden());
            mockMvc.perform(get("/api/posts/" + post.getId()).with(as(otherLeader)))
                    .andExpect(status().isForbidden());
            mockMvc.perform(get("/api/posts/" + post.getId()).with(as(pastor)))
                    .andExpect(status().isOk());
        }
    }

    @Nested
    @DisplayName("예산안 상세")
    class BudgetDetail {

        @Test
        @DisplayName("★ 기간 밖이면 임원도 403 — 예산안은 임원만 보는 글이라 임원이 빠지면 기간이 무의미")
        void 임원도_기간을_따른다() throws Exception {
            Post post = budget(NOW.minusSeconds(7 * 86_400), YESTERDAY);

            mockMvc.perform(get("/api/posts/" + post.getId()).with(as(otherLeader)))
                    .andExpect(status().isForbidden());
            mockMvc.perform(get("/api/posts/" + post.getId()).with(as(pastor)))
                    .andExpect(status().isOk());
            mockMvc.perform(get("/api/posts/" + post.getId()).with(as(author)))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("회원에게는 기간과 상관없이 여전히 404 — 존재를 숨기는 규칙이 먼저다")
        void 회원은_404() throws Exception {
            Post post = budget(YESTERDAY, TOMORROW);

            mockMvc.perform(get("/api/posts/" + post.getId()).with(as(member)))
                    .andExpect(status().isNotFound());
        }
    }

    // ── 목록 ─────────────────────────────────────────────────

    @Test
    @DisplayName("기간 밖 글도 목록에 남고, 상태 · 사람 기준 canView가 붙는다")
    void 목록() throws Exception {
        minutes(YESTERDAY, TOMORROW);
        minutes(NOW.minusSeconds(7 * 86_400), YESTERDAY);
        minutes(TOMORROW, TOMORROW.plusSeconds(86_400));
        minutes(null, null);

        // 상태 → 이 사람이 열 수 있는가. 기간 없는 예전 글도 CLOSED다
        assertThat(statusToCanView(member)).containsExactlyInAnyOrder(
                "OPEN:true", "SCHEDULED:false", "CLOSED:false", "CLOSED:false");
        // 같은 목록이 전도사에게는 전부 열린다
        assertThat(statusToCanView(pastor)).containsExactlyInAnyOrder(
                "OPEN:true", "SCHEDULED:true", "CLOSED:true", "CLOSED:true");
    }

    /** 회의록 목록을 「상태:canView」 문자열로 */
    private List<String> statusToCanView(Member who) throws Exception {
        String body = mockMvc.perform(get("/api/posts").param("category", "MINUTES").with(as(who)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<String> pairs = new java.util.ArrayList<>();
        objectMapper.readTree(body).path("data").path("items").forEach(item ->
                pairs.add(item.path("status").asText() + ":" + item.path("canView").asBoolean()));
        return pairs;
    }

    @Test
    @DisplayName("공지에는 기간 · 상태가 없다 (null) — 늘 canView")
    void 공지() throws Exception {
        postRepository.saveAndFlush(Post.builder()
                .category(PostCategory.NOTICE_MEMBER).title("공지").slug("notice")
                .body("{}").pinned(false).author(author).publishedAt(YESTERDAY).build());

        mockMvc.perform(get("/api/posts").param("category", "NOTICE_MEMBER").with(as(member)))
                .andExpect(jsonPath("$.data.items[0].status").value(nullValue()))
                .andExpect(jsonPath("$.data.items[0].viewableFrom").value(nullValue()))
                .andExpect(jsonPath("$.data.items[0].canView").value(true));
    }

    // ── 첨부 ─────────────────────────────────────────────────

    @Test
    @DisplayName("기간 밖 글의 첨부도 403 — 본문만 막으면 기간이 의미 없다")
    void 첨부() throws Exception {
        Post post = minutes(NOW.minusSeconds(7 * 86_400), YESTERDAY);
        Attachment file = attachmentRepository.saveAndFlush(Attachment.builder()
                .post(post).r2Key("attachments/1/회의록.pdf").filename("회의록.pdf")
                .contentType("application/pdf").sizeBytes(10).sortOrder(0).build());

        mockMvc.perform(get("/api/files/" + file.getId()).with(as(member)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/files/" + file.getId()).with(as(pastor)))
                .andExpect(status().isFound());
    }

    // ── 쓰기 ─────────────────────────────────────────────────

    @Nested
    @DisplayName("쓰기")
    class Write {

        @Test
        @DisplayName("회의록을 게시할 때 기간이 없으면 400 (field: viewableFrom)")
        void 기간_필수() throws Exception {
            mockMvc.perform(post("/api/posts").with(as(author))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json(form(PostCategory.MINUTES, true, null, null))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.field").value("viewableFrom"));
        }

        @Test
        @DisplayName("끝이 시작보다 앞이면 400 (field: viewableUntil)")
        void 기간_순서() throws Exception {
            mockMvc.perform(post("/api/posts").with(as(author))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json(form(PostCategory.BUDGET, true, TOMORROW, YESTERDAY))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.field").value("viewableUntil"));
        }

        @Test
        @DisplayName("임시저장은 기간을 비워 둘 수 있다")
        void 임시저장() throws Exception {
            mockMvc.perform(post("/api/posts").with(as(author))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json(form(PostCategory.MINUTES, false, null, null))))
                    .andExpect(status().isCreated());
        }

        @Test
        @DisplayName("공지에 기간을 보내면 버린다 — 저장되지 않는다")
        void 공지는_무시() throws Exception {
            mockMvc.perform(post("/api/posts").with(as(author))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json(form(PostCategory.NOTICE_PUBLIC, true, YESTERDAY, TOMORROW))))
                    .andExpect(status().isCreated());

            Post saved = postRepository.findAll().get(0);
            assertThat(saved.getViewableFrom()).isNull();
            assertThat(saved.getViewableUntil()).isNull();
        }

        @Test
        @DisplayName("기간 밖 글은 다른 임원이 열지도 고치지도 못한다 — 글쓴이 · 전도사는 된다")
        void 기간밖_수정() throws Exception {
            Post post = minutes(NOW.minusSeconds(7 * 86_400), YESTERDAY);
            String reopen = json(form(PostCategory.MINUTES, true, YESTERDAY, TOMORROW));

            mockMvc.perform(get("/api/admin/posts/" + post.getId()).with(as(otherLeader)))
                    .andExpect(status().isForbidden());
            mockMvc.perform(put("/api/posts/" + post.getId()).with(as(otherLeader))
                            .contentType(MediaType.APPLICATION_JSON).content(reopen))
                    .andExpect(status().isForbidden());

            mockMvc.perform(get("/api/admin/posts/" + post.getId()).with(as(author)))
                    .andExpect(status().isOk());
            // 글쓴이가 기간을 다시 열면 회원도 본다
            mockMvc.perform(put("/api/posts/" + post.getId()).with(as(author))
                            .contentType(MediaType.APPLICATION_JSON).content(reopen))
                    .andExpect(status().isNoContent());
            mockMvc.perform(get("/api/posts/" + post.getId()).with(as(member)))
                    .andExpect(status().isOk());
        }
    }

    // ── 보조 ─────────────────────────────────────────────────

    private Post minutes(Instant from, Instant until) {
        return windowed(PostCategory.MINUTES, from, until);
    }

    private Post budget(Instant from, Instant until) {
        return windowed(PostCategory.BUDGET, from, until);
    }

    private Post windowed(PostCategory category, Instant from, Instant until) {
        return postRepository.saveAndFlush(Post.builder()
                .category(category)
                .title(category + " " + System.nanoTime())
                .slug("slug-" + System.nanoTime())
                .body("{\"type\":\"doc\",\"content\":[]}")
                .pinned(false)
                .author(author)
                .publishedAt(YESTERDAY)
                .viewableFrom(from)
                .viewableUntil(until)
                .build());
    }

    private Map<String, Object> form(PostCategory category, boolean publish,
                                     Instant from, Instant until) {
        Map<String, Object> body = new HashMap<>();
        body.put("category", category.name());
        body.put("title", "제목 " + System.nanoTime());
        body.put("body", Map.of("type", "doc", "content", List.of()));
        body.put("pinned", false);
        body.put("publish", publish);
        body.put("viewableFrom", from == null ? null : from.toString());
        body.put("viewableUntil", until == null ? null : until.toString());
        return body;
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }

    private Member save(String name, String loginId, Role role) {
        return memberRepository.saveAndFlush(Member.builder()
                .name(name).loginId(loginId).role(role).build());
    }

    private static RequestPostProcessor as(Member who) {
        AuthPrincipal principal = new AuthPrincipal(who.getId(), who.getRole());
        return authentication(new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities()));
    }
}
