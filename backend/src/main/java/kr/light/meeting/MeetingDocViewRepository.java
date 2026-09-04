package kr.light.meeting;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;

public interface MeetingDocViewRepository extends JpaRepository<MeetingDocView, Long> {

    /**
     * 열람자별 집계 (SPEC_API.md §7.7) — 유출 시 워터마크와 대조하는 근거다.
     *
     * <p>한 사람이 페이지마다 행을 남기므로 <b>사람 단위로 접어서</b> 보여준다.
     * 그러지 않으면 10페이지를 본 사람이 목록에 10번 나온다.
     *
     * <p>{@code join fetch}가 아니라 필요한 값만 뽑는다 — 응답에 이름과 마을만
     * 나가므로 회원 엔티티 전체를 끌어올 이유가 없다.
     */
    @Query("""
            select v.member.name, v.member.rosterEntry.village,
                   max(v.viewedAt), max(v.pageNo)
            from MeetingDocView v
            where v.doc.id = :docId
            group by v.member.id, v.member.name, v.member.rosterEntry.village
            order by max(v.viewedAt) desc
            """)
    Page<Object[]> summarizeByDoc(@Param("docId") Long docId, Pageable pageable);

    /** 서로 다른 열람자 수 (§7.7 {@code totalViewers}) */
    @Query("select count(distinct v.member.id) from MeetingDocView v where v.doc.id = :docId")
    long countViewers(@Param("docId") Long docId);

    /**
     * 같은 사람이 같은 페이지를 <b>짧은 시간에 여러 번</b> 열었는지.
     *
     * <p>뷰어가 페이지를 앞뒤로 넘기면 같은 요청이 반복된다. 그때마다 행을
     * 남기면 열람 기록이 금세 수만 건이 되고, 정작 §7.7 화면에서 "누가
     * 봤는지"를 읽기 어려워진다.
     */
    boolean existsByDocIdAndMemberIdAndPageNoAndViewedAtAfter(
            Long docId, Long memberId, int pageNo, Instant after);
}
