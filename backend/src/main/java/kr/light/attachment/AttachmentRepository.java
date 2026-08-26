package kr.light.attachment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface AttachmentRepository extends JpaRepository<Attachment, Long> {

    /** 상세 응답용. 화면에 보이는 순서대로 (SPEC_API.md §3.3) */
    List<Attachment> findByPostIdOrderBySortOrderAscIdAsc(Long postId);

    /**
     * 목록의 {@code attachmentCount}용 — 게시물 여러 건의 첨부 개수를 한 번에 센다.
     *
     * <p>게시물마다 세면 페이지당 20번의 추가 쿼리가 나간다.
     */
    @Query("""
            select a.post.id as postId, count(a) as attachmentCount
            from Attachment a
            where a.post.id in :postIds
            group by a.post.id
            """)
    List<PostAttachmentCount> countByPostIds(@Param("postIds") Collection<Long> postIds);

    /** {@link #countByPostIds} 결과 한 행 */
    interface PostAttachmentCount {
        Long getPostId();

        long getAttachmentCount();
    }
}
