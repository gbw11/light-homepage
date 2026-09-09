package kr.light.meeting;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface MeetingDocPageRepository extends JpaRepository<MeetingDocPage, Long> {

    /** 한 자료의 페이지 — 순서대로 (§7.3 · §7.6) */
    List<MeetingDocPage> findByDocIdOrderByPageNoAsc(Long docId);

    /** 페이지 하나 (§7.3 스트리밍) */
    Optional<MeetingDocPage> findByDocIdAndPageNo(Long docId, int pageNo);

    /** 월례회 문서가 차지하는 바이트 (SPEC_API.md §8.5) */
    @Query("select coalesce(sum(p.sizeBytes), 0) from MeetingDocPage p")
    long sumSizeBytes();
}
