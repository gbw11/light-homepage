package kr.light.newcomer;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface NewcomerRepository extends JpaRepository<NewcomerRequest, Long> {

    /** 신청 목록 — 최근 신청이 위 (SPEC_API.md §8.6) */
    Page<NewcomerRequest> findAllByOrderByCreatedAtDescIdDesc(Pageable pageable);

    /**
     * 보유기간이 지난 신청 (§8.6 — <b>1년 후 삭제</b>).
     *
     * <p>⚠️ 이름·전화번호가 들어 있는 개인정보다. 지우는 것이 기능이 아니라
     * <b>약속</b>이다 — 폼에서 동의를 받을 때 보유기간을 고지했다.
     */
    List<NewcomerRequest> findByCreatedAtBefore(Instant cutoff);
}
