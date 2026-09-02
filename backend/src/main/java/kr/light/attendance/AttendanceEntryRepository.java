package kr.light.attendance;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface AttendanceEntryRepository extends JpaRepository<AttendanceEntry, Long> {

    /**
     * 한 회차의 기록 전부.
     *
     * <p>{@code join fetch rosterEntry} — 곧바로 명단의 이름·마을을 써야 하는데
     * LAZY로 두면 {@code open-in-view: false}라 꺼낼 수 없다. 게다가 인원수만큼
     * 쿼리가 나가는 N+1이 된다.
     */
    @Query("select e from AttendanceEntry e join fetch e.rosterEntry where e.session.id = :sessionId")
    List<AttendanceEntry> findBySessionId(@Param("sessionId") Long sessionId);

    /**
     * 회차별 집계 (§13.1) — <b>회차마다 상세를 부르지 않기 위해</b> 한 번에 센다.
     *
     * <p>목록 화면이 "체크 4/15"를 회차마다 보여준다. 회차 하나당 쿼리를 날리면
     * 20개 회차에 20번이 된다.
     *
     * @return {@code [sessionId, checkedCount, presentCount]} 행들
     */
    @Query("""
            select e.session.id, count(e), sum(case when e.status = kr.light.attendance.AttendanceStatus.PRESENT then 1 else 0 end)
            from AttendanceEntry e
            where e.session.id in :sessionIds
            group by e.session.id
            """)
    List<Object[]> countBySessionIds(@Param("sessionIds") Collection<Long> sessionIds);
}
