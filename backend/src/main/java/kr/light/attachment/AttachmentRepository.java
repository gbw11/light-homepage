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

    /**
     * 첨부와 <b>주보</b>가 차지하는 바이트 (SPEC_API.md §8.5).
     *
     * <p>주보 페이지도 이 테이블에 {@code bulletin_id}로 매달리므로 함께 세진다.
     *
     * <p>⚠️ 아직 아무것에도 연결되지 않은 첨부(post·bulletin 둘 다 null)도 센다.
     * 이미 R2에 올라가 실제로 용량을 쓰고 있기 때문이다 — 연결 여부는 우리
     * 사정이고, 과금은 객체의 존재로 일어난다. 미연결 행은 24시간 뒤 정리
     * 배치가 지운다 (§4.1).
     */
    @Query("select coalesce(sum(a.sizeBytes), 0) from Attachment a")
    long sumSizeBytes();

    /** {@link #countByPostIds} 결과 한 행 */
    interface PostAttachmentCount {
        Long getPostId();

        long getAttachmentCount();
    }
}
