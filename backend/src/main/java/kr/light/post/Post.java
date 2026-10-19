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

    /**
     * 열람 기간 — 회의록 · 예산안만 (V11, 2026-10-19). 공지는 늘 null.
     * 둘 다 있거나 둘 다 없다(DB CHECK). 기간이 없는 회의록 · 예산안은 잠김이다
     */
    @Column(name = "viewable_from")
    private Instant viewableFrom;

    @Column(name = "viewable_until")
    private Instant viewableUntil;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public boolean isPublished() {
        return publishedAt != null;
    }

    /**
     * 지금 열람 상태. 기간이 없는 분류(공지)는 null.
     *
     * <p>기간이 정해지지 않은 회의록 · 예산안(V11 이전 글)은 {@code CLOSED}다 —
     * 「기간 안에만 본다」는 규칙에서 기간이 없으면 볼 수 있는 때가 없다.
     */
    public PostViewStatus viewStatusAt(Instant now) {
        if (!category.hasViewWindow()) {
            return null;
        }
        if (viewableFrom == null || viewableUntil == null) {
            return PostViewStatus.CLOSED;
        }
        if (now.isBefore(viewableFrom)) {
            return PostViewStatus.SCHEDULED;
        }
        if (now.isAfter(viewableUntil)) {
            return PostViewStatus.CLOSED;
        }
        return PostViewStatus.OPEN;
    }

    /** 글쓴이인가 — 탈퇴한 작성자의 글은 누구의 것도 아니다 */
    public boolean isWrittenBy(Long memberId) {
        return memberId != null && author != null && memberId.equals(author.getId());
    }

    // ── 작성·수정 (SPEC_API.md §3.4 · §3.5) ────────────────────

    /**
     * 새 게시물.
     *
     * <p>{@code slug}는 공개 공지만 갖는다 — 다른 분류는 공개 주소가 없고,
     * DB에 unique 제약이 걸려 있어 빈 문자열을 넣으면 두 번째 글부터 충돌한다.
     *
     * @param body        리치텍스트 JSON <b>문자열</b>. 호출부가 JSON임을 보장한다
     * @param publishedAt null이면 임시저장
     */
    public static Post write(PostCategory category, String title, String slug, String body,
                             boolean pinned, Member author, Instant publishedAt,
                             Instant viewableFrom, Instant viewableUntil) {
        return Post.builder()
                .category(category)
                .title(title)
                .slug(slug)
                .body(body)
                .pinned(pinned)
                .author(author)
                .publishedAt(publishedAt)
                .viewableFrom(viewableFrom)
                .viewableUntil(viewableUntil)
                .build();
    }

    /**
     * 수정.
     *
     * <p><b>⚠️ 작성자는 바꾸지 않는다.</b> 다른 임원이 고쳐도 원 작성자가 남는다 —
     * 누가 쓴 글인지가 바뀌면 이력이 흐려진다. 누가 고쳤는지는 {@code updatedAt}과
     * 감사로그의 몫이다.
     *
     * <p><b>임시저장 → 게시</b>는 이 메서드로 일어난다. 반대(게시 → 임시저장)도
     * 허용한다 — 잘못 올린 글을 내리는 수단이 삭제뿐이면 너무 거칠다.
     */
    public void edit(PostCategory category, String title, String slug, String body,
                     boolean pinned, Instant publishedAt,
                     Instant viewableFrom, Instant viewableUntil) {
        this.category = category;
        this.title = title;
        this.slug = slug;
        this.body = body;
        this.pinned = pinned;
        this.publishedAt = publishedAt;
        this.viewableFrom = viewableFrom;
        this.viewableUntil = viewableUntil;
    }
}
