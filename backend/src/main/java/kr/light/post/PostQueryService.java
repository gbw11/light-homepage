package kr.light.post;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import kr.light.attachment.Attachment;
import kr.light.attachment.AttachmentRepository;
import kr.light.common.ApiException;
import kr.light.common.ErrorCode;
import kr.light.common.PageResponse;
import kr.light.member.Role;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 게시물 조회의 <b>단일 관문</b> (ARCHITECTURE.md §5.2).
 *
 * <p>공지·회의록·예산안이 한 테이블에 있으므로 category 권한 검사를 빠뜨리면
 * 예산안·회의록이 한 번에 전부 새어나간다. 이 프로젝트에는 RLS가 없어서
 * 여기가 실질적인 방어선이다.
 *
 * <p><b>⚠️ 새로운 게시물 조회 경로를 만들 때도 반드시
 * {@link #assertReadable}·{@link #assertVisible}을 통과시킬 것.</b> 리포지토리를
 * 직접 부르는 경로가 하나라도 생기면 관문이 의미를 잃는다.
 *
 * <p>Controller가 받은 category를 그대로 신뢰하지 않는다 — 상세 조회는 글을 먼저
 * 찾고 <b>그 글이 실제로 가진</b> category로 검사한다 (SPEC_API.md §3.3).
 */
@Service
@RequiredArgsConstructor
public class PostQueryService {

    private final PostRepository postRepository;
    private final AttachmentRepository attachmentRepository;
    private final ObjectMapper objectMapper;

    /** SPEC_API.md §1.6 — 기본 20, 최대 100 */
    static final int DEFAULT_SIZE = 20;
    static final int MAX_SIZE = 100;

    // ── 단일 관문 ──────────────────────────────────────────────

    /**
     * 목록 조회 권한 (ARCHITECTURE.md §5.3 인가 매트릭스).
     *
     * <table>
     *   <tr><th>category</th><th>GUEST</th><th>PENDING</th><th>MEMBER</th><th>LEADER·PASTOR</th></tr>
     *   <tr><td>NOTICE_PUBLIC</td><td>200</td><td>200</td><td>200</td><td>200</td></tr>
     *   <tr><td>NOTICE_MEMBER</td><td>401</td><td>403</td><td>200</td><td>200</td></tr>
     *   <tr><td>MINUTES·BUDGET</td><td>401</td><td>403</td><td>403</td><td>200</td></tr>
     * </table>
     *
     * @param role 비로그인이면 null
     */
    public void assertReadable(PostCategory category, Role role) {
        if (category == PostCategory.NOTICE_PUBLIC) {
            return;     // 누구나 — 비로그인·미승인 포함
        }
        if (role == null) {
            // 로그인하면 볼 수 있을지도 모르므로 401이다. 403이 아니다.
            throw ApiException.unauthorized();
        }
        if (role == Role.PENDING) {
            // FE는 이 코드를 보고 어느 화면에 있든 /pending으로 보낸다
            throw ApiException.pendingApproval();
        }
        if (!canRead(category, role)) {
            throw ApiException.forbidden();
        }
    }

    /**
     * 상세 조회 권한 — <b>존재 자체를 숨긴다.</b>
     *
     * <p>{@link #assertReadable}과 같지만 "역할이 모자란 회원"에게는 403이 아니라
     * <b>404</b>를 준다. 403을 주면 "그 글이 있다"는 사실이 새어나가고, 예산안은
     * 그 사실 자체가 민감하다 (ARCHITECTURE.md §5.2).
     *
     * <p>비로그인(401)과 미승인(403 PENDING_APPROVAL)은 그대로 둔다 — 매트릭스가
     * 그렇게 정하고 있고, 둘 다 "이 글"에 대한 정보를 흘리지 않는다.
     */
    public void assertVisible(PostCategory category, Role role) {
        try {
            assertReadable(category, role);
        } catch (ApiException e) {
            if (e.code() == ErrorCode.FORBIDDEN) {
                throw ApiException.notFound();
            }
            throw e;
        }
    }

    /** 역할이 이 분류를 읽을 수 있는가 (PENDING·비로그인은 위에서 이미 걸러졌다) */
    private boolean canRead(PostCategory category, Role role) {
        return switch (category) {
            case NOTICE_PUBLIC -> true;
            case NOTICE_MEMBER -> role == Role.MEMBER || role == Role.LEADER || role == Role.PASTOR;
            case MINUTES, BUDGET -> role == Role.LEADER || role == Role.PASTOR;
        };
    }

    // ── 조회 ──────────────────────────────────────────────────

    /**
     * 분류별 목록 (SPEC_API.md §3.2).
     *
     * <p>정렬은 리포지토리 쿼리에 고정돼 있다 — {@code pinned} 우선 →
     * {@code publishedAt} 최신순.
     */
    @Transactional(readOnly = true)
    public PageResponse<PostSummaryResponse> list(PostCategory category, Role role, int page, int size) {
        assertReadable(category, role);

        Page<Post> posts = postRepository.findPublished(category, PageRequest.of(page, size));
        Map<Long, Long> counts = attachmentCounts(posts.getContent());

        return PageResponse.of(posts, post ->
                PostSummaryResponse.of(post, counts.getOrDefault(post.getId(), 0L)));
    }

    /**
     * 상세 (SPEC_API.md §3.3).
     *
     * <p><b>⚠️ 순서가 중요하다.</b> 글을 먼저 찾고, 그 글이 가진 category로 권한을
     * 검사한다. category를 파라미터로 받아 걸러내는 방식은 우회할 수 있다.
     *
     * <p>없는 글과 권한 없는 글이 <b>같은 404</b>로 나가야 한다. 응답이 갈리면
     * 그 차이만으로 존재를 알아낼 수 있다.
     */
    @Transactional(readOnly = true)
    public PostDetailResponse get(String idOrSlug, Role role) {
        Post post = postRepository
                .findPublishedByIdOrSlug(parseIdOrNull(idOrSlug), idOrSlug)
                .orElseThrow(ApiException::notFound);

        assertVisible(post.getCategory(), role);

        List<Attachment> attachments =
                attachmentRepository.findByPostIdOrderBySortOrderAscIdAsc(post.getId());
        return PostDetailResponse.of(post, parseBody(post), attachments);
    }

    /**
     * 저장된 리치텍스트를 JSON으로 되돌린다.
     *
     * <p>깨진 값이면 여기서 터뜨린다(→ 500 + 로그). 조용히 null로 흘려보내면 FE가
     * 빈 글을 렌더링하고, 본문이 사라졌다는 사실이 아무 데도 남지 않는다.
     *
     * <p>애초에 깨진 값이 들어오지 않게 하는 것은 쓰기 쪽 책임이다 —
     * {@code POST /api/posts}(M2)에서 본문이 JSON인지 검증할 것.
     */
    private JsonNode parseBody(Post post) {
        try {
            return objectMapper.readTree(post.getBody());
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(
                    "게시물 %d의 body가 JSON이 아니다".formatted(post.getId()), e);
        }
    }

    // ── 보조 ──────────────────────────────────────────────────

    /**
     * {@code {idOrSlug}}가 숫자면 id로도 찾아본다.
     *
     * <p>slug는 숫자만으로 이루어질 수도 있으므로 둘 중 하나로 단정하지 않고
     * 쿼리에서 {@code id = :id or slug = :slug}로 함께 본다. 숫자가 아니면
     * id 조건은 절대 맞지 않도록 null을 넘긴다.
     */
    private Long parseIdOrNull(String idOrSlug) {
        try {
            return Long.parseLong(idOrSlug);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** 게시물별 첨부 개수. 첨부가 없는 글은 결과에 없으므로 호출부에서 0으로 채운다. */
    private Map<Long, Long> attachmentCounts(List<Post> posts) {
        if (posts.isEmpty()) {
            return Map.of();
        }
        List<Long> ids = posts.stream().map(Post::getId).toList();
        return attachmentRepository.countByPostIds(ids).stream()
                .collect(Collectors.toMap(
                        AttachmentRepository.PostAttachmentCount::getPostId,
                        AttachmentRepository.PostAttachmentCount::getAttachmentCount));
    }

    /**
     * 페이징 파라미터 정규화 (SPEC_API.md §1.6 — 기본 0/20, 최대 100).
     *
     * <p>{@code size}가 100을 넘으면 400이 아니라 100으로 자른다. FE가 공개 공지를
     * 빌드 시점에 정적 생성하면서 크게 요청해도 {@code hasNext}로 계속 훑을 수
     * 있어야 하고, 여기서 400을 내면 그 빌드가 통째로 실패한다.
     *
     * <p>문서에 초과 시 동작이 없어 이렇게 정했다 — FE와 공유 대상이다.
     */
    static int normalizeSize(Integer size) {
        if (size == null || size < 1) {
            return DEFAULT_SIZE;
        }
        return Math.min(size, MAX_SIZE);
    }

    static int normalizePage(Integer page) {
        return (page == null || page < 0) ? 0 : page;
    }
}
