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

    /**
     * 임시저장 글 목록 — 임원용 (SPEC_API.md §3.6, 2026-10-07).
     *
     * <p>{@link #findPublished}의 정반대다. 분류를 가리지 않고 모은다 — 임원은
     * 네 분류를 모두 쓸 수 있고(§3.1 작성 열), 임시저장 글을 이어 쓰는 사람이
     * 원 작성자가 아닐 수도 있다(다른 임원이 고쳐도 작성자는 그대로 —
     * {@link PostCommandService#update}). 최근에 손댄 글이 위로 온다.
     */
    @Query(value = """
            select p from Post p
            left join fetch p.author
            where p.publishedAt is null
            order by p.updatedAt desc, p.id desc
            """,
            countQuery = """
                    select count(p) from Post p
                    where p.publishedAt is null
                    """)
    Page<Post> findDrafts(Pageable pageable);

    /**
     * 수정 화면용 단건 조회 — <b>게시 여부와 무관하게</b> id로만 찾는다 (§3.7).
     *
     * <p>{@link #findPublishedByIdOrSlug}는 임시저장 글을 걸러서, 임시저장한
     * 글을 수정 화면에서 다시 열 수 없었다. slug는 받지 않는다 — 수정 화면은
     * 언제나 id로 들어온다.
     */
    @Query("""
            select p from Post p
            left join fetch p.author
            where p.id = :id
            """)
    Optional<Post> findForEdit(@Param("id") Long id);

    /** slug 중복 확인용 (PostSlugGenerator). 임시저장 글도 slug를 점유한다. */
    Optional<Post> findBySlug(String slug);
}
