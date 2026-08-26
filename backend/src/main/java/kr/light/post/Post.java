package kr.light.post;

import jakarta.persistence.*;
import kr.light.member.Member;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * 게시물 — 공지 · 회의록 · 예산안 통합.
 *
 * <p>구조가 동일하고 권한만 다르므로 한 테이블에 합쳤다(ARCHITECTURE.md §3.1).
 * 대신 category 권한 검사가 유일한 방어선이 된다.
 */
@Entity
@Table(name = "posts")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class Post {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PostCategory category;

    @Column(nullable = false, length = 200)
    private String title;

    /** 공개 공지만 사용 (SEO용 주소) */
    @Column(length = 200)
    private String slug;

    /** 리치텍스트 JSON (Tiptap) */
    @Column(nullable = false, columnDefinition = "text")
    private String body;

    @Column(nullable = false)
    private boolean pinned;

    /** 작성자가 탈퇴해도 글은 남는다 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id")
    private Member author;

    /** null이면 임시저장 (SPEC_API.md §3.4 publish:false) */
    @Column(name = "published_at")
    private Instant publishedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public boolean isPublished() {
        return publishedAt != null;
    }
}
