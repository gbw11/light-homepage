package kr.light.post;

import com.fasterxml.jackson.databind.JsonNode;
import kr.light.attachment.Attachment;
import kr.light.attachment.AttachmentRepository;
import kr.light.common.ApiException;
import kr.light.member.Member;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * 게시물 작성·수정·삭제 (SPEC_API.md §3.4 · §3.5).
 *
 * <p>조회는 {@link PostQueryService}가 맡는다. 읽기는 분류별로 권한이 갈리지만
 * <b>쓰기는 네 분류 모두 LEADER 이상</b>이라(§3.1 작성 열), 분류별 관문이 필요
 * 없어 나눴다.
 *
 * <p><b>⚠️ 권한 검사는 여기서 하지 않는다.</b> 컨트롤러의
 * {@code @PreAuthorize("hasRole('LEADER')")}가 1층이다. 이 클래스는 "임원이
 * 부른 것"을 전제로 도메인 규칙만 본다 (ARCHITECTURE.md §5.2).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PostCommandService {

    private final PostRepository postRepository;
    private final AttachmentRepository attachmentRepository;
    private final PostSlugGenerator slugGenerator;

    // ── 작성 (§3.4) ───────────────────────────────────────────

    @Transactional
    public Long create(PostWriteRequest request, Member author, Instant now) {
        Post post = postRepository.save(Post.write(
                request.category(),
                request.title(),
                slugFor(request, null),
                request.body().toString(),
                request.pinned(),
                author,
                request.publish() ? now : null));

        linkAttachments(post, request.attachmentIdsOrEmpty());
        return post.getId();
    }

    // ── 수정 (§3.5) ───────────────────────────────────────────

    /**
     * 수정.
     *
     * <p><b>⚠️ 임시저장 글도 수정 대상이다.</b> 조회용
     * {@code findPublishedByIdOrSlug}를 쓰면 안 된다 — 그건 게시된 글만
     * 찾으므로, 작성 중인 글을 이어서 고칠 수가 없어진다.
     */
    @Transactional
    public void update(Long postId, PostWriteRequest request, Instant now) {
        Post post = postRepository.findById(postId).orElseThrow(ApiException::notFound);

        post.edit(
                request.category(),
                request.title(),
                slugFor(request, postId),
                request.body().toString(),
                request.pinned(),
                resolvePublishedAt(post, request.publish(), now));

        relinkAttachments(post, request.attachmentIdsOrEmpty());
    }

    /**
     * 게시 시각을 정한다.
     *
     * <p><b>이미 게시된 글을 다시 저장해도 게시일이 바뀌지 않는다.</b> 오타 하나
     * 고쳤다고 목록 맨 위로 올라오면 안 된다 — 목록 정렬이 {@code publishedAt}
     * 기준이기 때문이다.
     */
    private Instant resolvePublishedAt(Post post, boolean publish, Instant now) {
        if (!publish) {
            return null;                              // 게시 → 임시저장으로 내림
        }
        return post.isPublished() ? post.getPublishedAt() : now;
    }

    // ── 삭제 (§3.5) ───────────────────────────────────────────

    /**
     * 삭제.
     *
     * <p><b>⚠️ R2 객체는 아직 지우지 않는다.</b> 명세(§3.5)는 "첨부 R2 객체까지
     * 제거"를 요구하지만 R2 클라이언트가 M3다. 첨부 <b>행</b>은 여기서 함께
     * 지우므로, <b>DB에서 참조가 끊긴 객체가 R2에 남는다</b> — 용량이 조용히
     * 새는 경로다 (ARCHITECTURE.md §4.3).
     *
     * <p>지금은 업로드 API 자체가 M4라 실제 객체가 생기지 않아 유출이 없다.
     * <b>M3에서 R2 클라이언트를 붙일 때 여기에 객체 삭제를 넣을 것.</b>
     */
    @Transactional
    public void delete(Long postId) {
        Post post = postRepository.findById(postId).orElseThrow(ApiException::notFound);

        List<Attachment> attachments =
                attachmentRepository.findByPostIdOrderBySortOrderAscIdAsc(postId);
        if (!attachments.isEmpty()) {
            // TODO(M3): R2 객체 삭제. 지금은 키만 남기고 지나간다.
            log.warn("게시물 삭제 — R2 객체 {}개가 남는다 (M3에서 정리). posts.id={}",
                    attachments.size(), postId);

            // ⚠️ DB의 FK가 ON DELETE CASCADE지만 그것만 믿으면 안 된다. 위에서
            //    첨부를 영속성 컨텍스트에 올려둔 상태라, 게시물만 지우면 flush
            //    시점에 "없어진 Post를 참조하는 Attachment"가 남아
            //    TransientObjectException이 난다. 명시적으로 먼저 지운다.
            attachmentRepository.deleteAll(attachments);
        }

        postRepository.delete(post);
    }

    // ── 첨부 연결 ─────────────────────────────────────────────

    /**
     * 첨부를 이 게시물에 매단다.
     *
     * <p>업로드된 첨부는 <b>어디에도 연결되지 않은 상태</b>로 먼저 생기고
     * (§4.1), 게시물 저장 시 여기서 연결된다. 연결되지 않은 첨부는 24시간 뒤
     * 정리 배치가 지운다.
     *
     * <p><b>⚠️ 남의 게시물에 붙은 첨부를 가져올 수 없다.</b> 이미 다른 글에
     * 연결된 id를 넘기면 거부한다 — 허용하면 첨부가 원래 글에서 사라진다.
     */
    private void linkAttachments(Post post, List<String> attachmentIds) {
        for (String rawId : attachmentIds) {
            Attachment attachment = attachmentRepository.findById(parseId(rawId))
                    .orElseThrow(() -> ApiException.validation(
                            "attachmentIds", "첨부를 찾을 수 없습니다: " + rawId));

            if (attachment.getPost() != null && !attachment.getPost().getId().equals(post.getId())) {
                throw ApiException.validation(
                        "attachmentIds", "다른 게시물에 연결된 첨부입니다: " + rawId);
            }
            if (attachment.getBulletin() != null) {
                // DB CHECK가 post와 bulletin 동시 연결을 금지한다
                throw ApiException.validation(
                        "attachmentIds", "주보에 연결된 첨부입니다: " + rawId);
            }
            attachment.linkTo(post);
        }
    }

    /**
     * 수정 시 첨부 재연결.
     *
     * <p>목록에서 빠진 첨부는 <b>연결만 끊는다</b>. 지우지 않는 이유는 정리
     * 배치(§4.1)가 24시간 뒤 처리하기 때문이고, 그 사이 사용자가 마음을 바꿔
     * 다시 붙일 수도 있다.
     */
    private void relinkAttachments(Post post, List<String> attachmentIds) {
        attachmentRepository.findByPostIdOrderBySortOrderAscIdAsc(post.getId())
                .forEach(Attachment::unlink);
        linkAttachments(post, attachmentIds);
    }

    private Long parseId(String rawId) {
        try {
            return Long.parseLong(rawId);
        } catch (NumberFormatException e) {
            throw ApiException.validation("attachmentIds", "첨부 ID 형식이 올바르지 않습니다: " + rawId);
        }
    }

    // ── slug ──────────────────────────────────────────────────

    /**
     * 공개 공지만 slug를 갖는다.
     *
     * <p>다른 분류는 공개 주소가 없고, {@code posts_slug_uk} unique 제약 때문에
     * 빈 문자열을 넣으면 두 번째 글부터 충돌한다. null이어야 한다.
     */
    private String slugFor(PostWriteRequest request, Long excludedPostId) {
        return request.category() == PostCategory.NOTICE_PUBLIC
                ? slugGenerator.generate(request.title(), excludedPostId)
                : null;
    }
}
