package kr.light.post;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface PostRepository extends JpaRepository<Post, Long> {

    /**
     * 분류별 게시 목록.
     *
     * <p>{@code join fetch author}가 없으면 목록 20건마다 작성자 조회 쿼리가
     * 20번 더 나간다({@code author}는 LAZY이고 {@code open-in-view: false}라
     * 컨트롤러에서는 만질 수도 없다).
     *
     * <p>{@code publishedAt is not null} — 임시저장 글은 목록에 넣지 않는다
     * (SPEC_API.md §3.4의 {@code publish:false}).
     *
     * <p>정렬은 {@code pinned} 우선 → {@code publishedAt} 최신순(SPEC_API.md §3.2).
     * {@code Pageable}의 정렬을 받지 않고 여기에 고정한다 — 호출자가 정렬을
     * 바꿀 수 있으면 계약이 흔들린다. DB 인덱스도 이 순서에 맞춰져 있다
     * ({@code posts_list_idx}).
     */
    @Query(value = """
            select p from Post p
            left join fetch p.author
            where p.category = :category
              and p.publishedAt is not null
            order by p.pinned desc, p.publishedAt desc
            """,
            countQuery = """
                    select count(p) from Post p
                    where p.category = :category
                      and p.publishedAt is not null
                    """)
    Page<Post> findPublished(@Param("category") PostCategory category, Pageable pageable);

    /**
     * 상세 조회 — id 또는 slug.
     *
     * <p><b>⚠️ category를 조건에 넣지 않는다.</b> 먼저 글을 찾고 그 글이 실제로
     * 가진 category로 권한을 검사해야 우회가 막힌다 (ARCHITECTURE.md §5.2).
     * {@code findByIdAndCategory} 형태로 만들면 요청자가 분류를 지정하는 셈이 된다.
     */
    @Query("""
            select p from Post p
            left join fetch p.author
            where (p.id = :id or p.slug = :slug)
              and p.publishedAt is not null
            """)
    Optional<Post> findPublishedByIdOrSlug(@Param("id") Long id, @Param("slug") String slug);

    /** slug 중복 확인용 (PostSlugGenerator). 임시저장 글도 slug를 점유한다. */
    Optional<Post> findBySlug(String slug);
}
