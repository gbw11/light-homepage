package kr.light.bulletin;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface BulletinRepository extends JpaRepository<Bulletin, Long> {

    /** 목록 — 최근 주일이 위 (SPEC_API.md §5.2) */
    Page<Bulletin> findAllByOrderByServiceDateDescIdDesc(Pageable pageable);

    /** §5.1 — 가장 최근 주보. 없으면 data: null */
    Optional<Bulletin> findFirstByOrderByServiceDateDescIdDesc();

    /** §5.4 — 같은 날짜는 하나뿐 */
    boolean existsByServiceDate(LocalDate serviceDate);
}
