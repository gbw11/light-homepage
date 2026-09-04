package kr.light.attendance;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;

public interface AttendanceSessionRepository extends JpaRepository<AttendanceSession, Long> {

    /** 날짜 내림차순 (§13.1) — 최근 회차를 먼저 본다 */
    Page<AttendanceSession> findAllByOrderByDateDescIdDesc(Pageable pageable);

    /** 같은 날짜 + 같은 종류가 이미 있는가 (§13.2 DUPLICATE) */
    boolean existsByDateAndType(LocalDate date, AttendanceSessionType type);
}
