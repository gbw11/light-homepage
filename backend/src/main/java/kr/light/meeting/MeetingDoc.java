package kr.light.meeting;

import jakarta.persistence.*;
import kr.light.member.Member;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.time.LocalDate;

/**
 * 월례회 자료 — 열람 기간이 지나면 MEMBER는 볼 수 없다.
 *
 * <p>★ 원본(Word/PDF)은 저장하지 않는다. 남으면 그 자체가 다운로드 가능한
 * 유출 경로가 된다. 페이지 이미지만 보관한다 (BACKEND_TASKS.md §7.3).
 */
@Entity
@Table(name = "meeting_docs")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class MeetingDoc {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(name = "meeting_date", nullable = false)
    private LocalDate meetingDate;

    @Column(name = "viewable_from", nullable = false)
    private Instant viewableFrom;

    /** ★ 이후 MEMBER는 열람 불가. LEADER 이상은 기간과 무관하게 열람 가능 */
    @Column(name = "viewable_until", nullable = false)
    private Instant viewableUntil;

    @Column(name = "page_count", nullable = false)
    private int pageCount;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private Member createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /**
     * 지금이 열람 기간 안인가.
     *
     * <p>⚠️ 이 검사는 MEMBER에게만 적용한다. LEADER 이상은 건너뛴다.
     * 호출하는 쪽에서 역할을 먼저 판단할 것 (SPEC_API.md §7.3).
     */
    public boolean isOpenAt(Instant now) {
        return !now.isBefore(viewableFrom) && !now.isAfter(viewableUntil);
    }

    public MeetingDocStatus statusAt(Instant now) {
        if (now.isBefore(viewableFrom)) return MeetingDocStatus.SCHEDULED;
        if (now.isAfter(viewableUntil)) return MeetingDocStatus.CLOSED;
        return MeetingDocStatus.OPEN;
    }

    /**
     * 변환이 끝난 뒤 페이지 수를 채운다 (§7.4).
     *
     * <p>업로드 시점에는 몇 쪽인지 알 수 없다 — PDF를 열어봐야 안다.
     * 그런데 R2 키에 문서 id가 들어가서 행을 먼저 만들어야 한다.
     */
    public void setPageCount(int pageCount) {
        this.pageCount = pageCount;
    }

    public void changeWindow(Instant from, Instant until) {
        this.viewableFrom = from;
        this.viewableUntil = until;
    }
}
