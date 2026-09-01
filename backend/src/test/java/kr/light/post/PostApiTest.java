package kr.light.post;

import jakarta.persistence.EntityManager;
import kr.light.attachment.Attachment;
import kr.light.attachment.AttachmentRepository;
import kr.light.member.Member;
import kr.light.member.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 공개 공지 API의 실제 응답 형태 (SPEC_API.md §3.2 · §3.3).
 *
 * <p>Security 필터 체인까지 태운 full-context 테스트다. {@code GET /api/posts}가
 * 필터에서 열려 있는지와 응답 형태를 함께 본다 — 둘 중 하나만 어긋나도 FE는 못 쓴다.
 *
 * <p>역할별 인가는 {@link PostAuthorizationTest}가 덮는다. 인증 수단이 M2라
 * 여기서 HTTP로 만들 수 있는 것은 비로그인(GUEST) 행뿐이다.
 *
 * <p>⚠️ 이름에 {@code Authorization}을 넣지 않았다. Jenkinsfile이 그 이름으로
 * 인가 매트릭스만 골라 돌리는데, 이 클래스는 그 매트릭스가 아니다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class PostApiTest {

    @Autowired MockMvc mockMvc;
    @Autowired PostRepository postRepository;
    @Autowired AttachmentRepository attachmentRepository;
    @Autowired EntityManager em;

    private static final String BODY_JSON = "{\"type\":\"doc\",\"content\":[]}";

    private Member author;

    @BeforeEach
    void setUp() {
        // @Transactional이라 각 테스트 뒤 롤백된다. 그래도 시작 시 비워 두어야
        // 다른 곳이 남긴 행이 목록 순서 단언을 흔들지 않는다.
        attachmentRepository.deleteAllInBatch();
        postRepository.deleteAllInBatch();

        author = Member.builder()
                .loginId("author")
                .name("박도연")
                .role(Role.LEADER)
                .build();
        em.persist(author);
    }

    // ── 목록 ──────────────────────────────────────────────────

    @Test
    @DisplayName("공개 공지 목록은 비로그인으로 열린다")
    void 목록은_비로그인으로_열린다() throws Exception {
        savePost("여름 수련회 신청 안내", "summer-retreat-2026", true, hoursAgo(1));

        mockMvc.perform(get("/api/posts").param("category", "NOTICE_PUBLIC"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items").isArray())
                .andExpect(jsonPath("$.data.items[0].title").value("여름 수련회 신청 안내"))
                .andExpect(jsonPath("$.data.items[0].slug").value("summer-retreat-2026"))
                .andExpect(jsonPath("$.data.items[0].category").value("NOTICE_PUBLIC"))
                .andExpect(jsonPath("$.data.items[0].authorName").value("박도연"))
                // ID는 문자열, 개수는 숫자 (SPEC_API.md §1.3)
                .andExpect(jsonPath("$.data.items[0].id").isString())
                .andExpect(jsonPath("$.data.items[0].attachmentCount").isNumber())
                .andExpect(jsonPath("$.data.page").value(0))
                .andExpect(jsonPath("$.data.size").value(20))
                .andExpect(jsonPath("$.data.hasNext").value(false));
    }

    @Test
    @DisplayName("정렬은 상단고정 우선 → 게시일 최신순")
    void 정렬은_고정_우선_최신순() throws Exception {
        savePost("오래된 일반 공지", "old", false, hoursAgo(10));
        savePost("최신 일반 공지", "new", false, hoursAgo(1));
        savePost("오래된 고정 공지", "old-pinned", true, hoursAgo(20));

        mockMvc.perform(get("/api/posts").param("category", "NOTICE_PUBLIC"))
                .andExpect(status().isOk())
                // 고정 글이 가장 오래됐어도 맨 위다
                .andExpect(jsonPath("$.data.items[0].title").value("오래된 고정 공지"))
                .andExpect(jsonPath("$.data.items[1].title").value("최신 일반 공지"))
                .andExpect(jsonPath("$.data.items[2].title").value("오래된 일반 공지"));
    }

    @Test
    @DisplayName("임시저장 글은 목록에 나오지 않는다")
    void 임시저장은_목록에서_빠진다() throws Exception {
        savePost("게시된 공지", "published", false, hoursAgo(1));
        savePost("작성 중인 공지", "draft", false, null);

        mockMvc.perform(get("/api/posts").param("category", "NOTICE_PUBLIC"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].title").value("게시된 공지"));
    }

    @Test
    @DisplayName("첨부 개수는 게시물별로 정확히 센다")
    void 첨부_개수() throws Exception {
        Post withTwo = savePost("첨부 둘", "two", false, hoursAgo(1));
        savePost("첨부 없음", "none", false, hoursAgo(2));
        saveAttachment(withTwo, "신청서.xlsx", 0);
        saveAttachment(withTwo, "안내문.pdf", 1);

        mockMvc.perform(get("/api/posts").param("category", "NOTICE_PUBLIC"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].attachmentCount").value(2))
                .andExpect(jsonPath("$.data.items[1].attachmentCount").value(0));
    }

    @Test
    @DisplayName("글이 없으면 빈 목록이다 — 404가 아니다")
    void 빈_목록() throws Exception {
        mockMvc.perform(get("/api/posts").param("category", "NOTICE_PUBLIC"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items").isEmpty())
                .andExpect(jsonPath("$.data.hasNext").value(false));
    }

    @Test
    @DisplayName("size는 100을 넘겨도 100으로 잘린다 — 400이 아니다")
    void size는_100으로_잘린다() throws Exception {
        savePost("공지", "notice", false, hoursAgo(1));

        mockMvc.perform(get("/api/posts")
                        .param("category", "NOTICE_PUBLIC")
                        .param("size", "5000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.size").value(100));
    }

    @Test
    @DisplayName("hasNext는 다음 페이지가 있을 때 true다")
    void 페이징() throws Exception {
        savePost("첫째", "a", false, hoursAgo(1));
        savePost("둘째", "b", false, hoursAgo(2));

        mockMvc.perform(get("/api/posts")
                        .param("category", "NOTICE_PUBLIC")
                        .param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].title").value("첫째"))
                .andExpect(jsonPath("$.data.hasNext").value(true));

        mockMvc.perform(get("/api/posts")
                        .param("category", "NOTICE_PUBLIC")
                        .param("size", "1")
                        .param("page", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].title").value("둘째"))
                .andExpect(jsonPath("$.data.hasNext").value(false));
    }

    @Test
    @DisplayName("category 없이 부르면 400 VALIDATION_ERROR")
    void category는_필수다() throws Exception {
        mockMvc.perform(get("/api/posts"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.field").value("category"));
    }

    @Test
    @DisplayName("없는 분류를 넣으면 400 — 500으로 새지 않는다")
    void 잘못된_분류() throws Exception {
        mockMvc.perform(get("/api/posts").param("category", "SECRET"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    @DisplayName("예산안 목록을 비로그인으로 부르면 403 — 401이 아니다")
    void 예산안_목록은_비로그인에게_403() throws Exception {
        savePost("예산안", null, false, hoursAgo(1), PostCategory.BUDGET);

        // ★ 예산안은 "로그인하면 볼 수 있는 글"이 아니라 임원 전용이다.
        //   401을 주면 FE가 로그인 화면으로 보내 있지도 않은 기대를 만든다.
        //   분류의 존재 자체는 이미 공개된 정보라 403으로 충분하다 (§10 주의 2).
        mockMvc.perform(get("/api/posts").param("category", "BUDGET"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    @DisplayName("회의록 목록을 비로그인으로 부르면 401 — 로그인하면 볼 수 있다")
    void 회의록_목록은_비로그인에게_401() throws Exception {
        savePost("회의록", null, false, hoursAgo(1), PostCategory.MINUTES);

        mockMvc.perform(get("/api/posts").param("category", "MINUTES"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    // ── 상세 ──────────────────────────────────────────────────

    @Test
    @DisplayName("상세는 slug로 조회된다")
    void 상세_slug() throws Exception {
        Post post = savePost("여름 수련회 신청 안내", "summer-retreat-2026", true, hoursAgo(1));
        saveAttachment(post, "신청서.xlsx", 0);

        mockMvc.perform(get("/api/posts/summer-retreat-2026"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("여름 수련회 신청 안내"))
                .andExpect(jsonPath("$.data.slug").value("summer-retreat-2026"))
                .andExpect(jsonPath("$.data.updatedAt").exists())
                // body는 문자열이 아니라 JSON 객체여야 한다 (SPEC_API.md §3.3)
                .andExpect(jsonPath("$.data.body").isMap())
                .andExpect(jsonPath("$.data.body.type").value("doc"))
                .andExpect(jsonPath("$.data.attachments[0].filename").value("신청서.xlsx"))
                .andExpect(jsonPath("$.data.attachments[0].id").isString())
                .andExpect(jsonPath("$.data.attachments[0].sizeBytes").isNumber())
                // r2Key는 절대 응답에 실리지 않는다 (SPEC_API.md §4.2)
                .andExpect(jsonPath("$.data.attachments[0].r2Key").doesNotExist());
    }

    @Test
    @DisplayName("상세는 id로도 조회된다")
    void 상세_id() throws Exception {
        Post post = savePost("공지", "notice", false, hoursAgo(1));

        mockMvc.perform(get("/api/posts/" + post.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(String.valueOf(post.getId())));
    }

    @Test
    @DisplayName("임시저장 글의 상세는 404다")
    void 임시저장_상세는_404() throws Exception {
        savePost("작성 중", "draft", false, null);

        mockMvc.perform(get("/api/posts/draft"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
    }

    @Test
    @DisplayName("없는 글은 404다")
    void 없는_글() throws Exception {
        mockMvc.perform(get("/api/posts/does-not-exist"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
    }

    @Test
    @DisplayName("예산안 상세를 비로그인으로 부르면 404 — 존재 자체를 숨긴다")
    void 예산안_상세는_존재를_숨긴다() throws Exception {
        Post budget = savePost("2026 예산안", null, false, hoursAgo(1), PostCategory.BUDGET);

        mockMvc.perform(get("/api/posts/" + budget.getId()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    @DisplayName("회의록 상세를 비로그인으로 부르면 401이고 제목이 새지 않는다")
    void 회의록_상세() throws Exception {
        Post minutes = savePost("8월 회의록", null, false, hoursAgo(1), PostCategory.MINUTES);

        String body = mockMvc.perform(get("/api/posts/" + minutes.getId()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"))
                .andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain("8월 회의록");
    }

    @Test
    @DisplayName("body가 깨져 있으면 조용히 넘기지 않고 500으로 드러낸다")
    void 깨진_body는_드러난다() throws Exception {
        // null body를 응답하면 FE는 빈 글을 렌더링하고 본문이 사라진 사실이
        // 아무 데도 남지 않는다. 쓰기 검증은 M2의 POST /api/posts 몫이다.
        postRepository.saveAndFlush(Post.builder()
                .category(PostCategory.NOTICE_PUBLIC)
                .title("본문이 깨진 공지")
                .slug("broken")
                .body("이건 JSON이 아니다")
                .pinned(false)
                .author(author)
                .publishedAt(hoursAgo(1))
                .build());

        mockMvc.perform(get("/api/posts/broken"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error.code").value("INTERNAL_ERROR"));

        // 목록은 body를 싣지 않으므로 영향받지 않는다
        mockMvc.perform(get("/api/posts").param("category", "NOTICE_PUBLIC"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].title").value("본문이 깨진 공지"));
    }

    // ── 보조 ──────────────────────────────────────────────────

    private Instant hoursAgo(int hours) {
        return Instant.now().minus(hours, ChronoUnit.HOURS);
    }

    private Post savePost(String title, String slug, boolean pinned, Instant publishedAt) {
        return savePost(title, slug, pinned, publishedAt, PostCategory.NOTICE_PUBLIC);
    }

    private Post savePost(String title, String slug, boolean pinned,
                          Instant publishedAt, PostCategory category) {
        return postRepository.saveAndFlush(Post.builder()
                .category(category)
                .title(title)
                .slug(slug)
                .body(BODY_JSON)
                .pinned(pinned)
                .author(author)
                .publishedAt(publishedAt)
                .build());
    }

    private void saveAttachment(Post post, String filename, int sortOrder) {
        attachmentRepository.saveAndFlush(Attachment.builder()
                .post(post)
                .r2Key("posts/" + post.getId() + "/" + filename)
                .filename(filename)
                .contentType("application/octet-stream")
                .sizeBytes(24576L)
                .sortOrder(sortOrder)
                .build());
    }
}
