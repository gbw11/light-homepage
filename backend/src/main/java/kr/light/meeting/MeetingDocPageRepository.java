package kr.light.meeting;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface MeetingDocPageRepository extends JpaRepository<MeetingDocPage, Long> {

    /** 월례회 문서가 차지하는 바이트 (SPEC_API.md §8.5) */
    @Query("select coalesce(sum(p.sizeBytes), 0) from MeetingDocPage p")
    long sumSizeBytes();
}
