package kr.light.attachment;

import jakarta.persistence.*;
import kr.light.bulletin.Bulletin;
import kr.light.post.Post;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * 첨부파일 — posts · bulletins 공용. 파일 본체는 R2에 있고 여기에는 키만 둔다.
 *
 * <p>업로드 직후에는 아직 어디에도 연결되지 않은 상태(둘 다 null)이며,
 * 게시물 저장 시 attachmentIds로 연결된다. 연결되지 않은 첨부는 24시간 후
 * 정리된다 (SPEC_API.md §4.1).
 *
 * <p>⚠️ 삭제 시 R2 객체까지 지워야 한다. 누락되면 용량이 조용히 새고 10GB를
 * 넘으면 과금이 시작된다.
 */
@Entity
@Table(name = "attachments")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class Attachment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** post_id와 bulletin_id는 동시에 채워질 수 없다 (DB CHECK 제약) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "post_id")
    private Post post;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bulletin_id")
    private Bulletin bulletin;

    @Column(name = "r2_key", nullable = false, length = 500)
    private String r2Key;

    /** 이미지(주보)인 경우의 썸네일 */
    @Column(name = "r2_key_thumb", length = 500)
    private String r2KeyThumb;

    @Column(nullable = false, length = 255)
    private String filename;

    @Column(name = "content_type", length = 100)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    /** 주보 페이지 순서 */
    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** 아직 게시물·주보 어느 쪽에도 연결되지 않은 상태인가 (정리 배치 대상) */
    public boolean isOrphan() {
        return post == null && bulletin == null;
    }
}
