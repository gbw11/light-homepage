package kr.light.meeting;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MeetingDocRepository extends JpaRepository<MeetingDoc, Long> {

    /** 목록 — 최근 월례회가 위 (SPEC_API.md §7.1) */
    Page<MeetingDoc> findAllByOrderByMeetingDateDescIdDesc(Pageable pageable);
}
