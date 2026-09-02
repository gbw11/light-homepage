package kr.light.attendance;

import jakarta.persistence.*;
import kr.light.member.Member;
import kr.light.roster.RosterEntry;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * 한 사람의 출결 기록 (SPEC_API.md §13.3 · §13.4).
 *
 * <p>★ <b>이 행이 있으면 "체크됨", 없으면 "기록 없음"이다.</b> §13.0이
 * {@code null}(기록 없음)과 {@code ABSENT}를 구별하라고 정하고 있어,
 * status에 null을 허용하는 대신 행의 존재로 그것을 표현한다 —
 * 그러면 {@code checkedCount}가 무엇을 세야 하는지도 분명해진다.
 */
@Entity
@Table(name = "attendance_entries")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class AttendanceEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private AttendanceSession session;

    /** ⚠️ 계정이 아니라 명단이다 — 계정 없는 교인도 체크한다 (§13 머리말) */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "roster_id", nullable = false)
    private RosterEntry rosterEntry;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private AttendanceStatus status;

    /** 마지막으로 체크한 사람. 두 임원이 나눠 체크하는 것이 정상 흐름이다 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by")
    private Member updatedBy;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public static AttendanceEntry create(AttendanceSession session, RosterEntry roster,
                                         AttendanceStatus status, Member actor) {
        return AttendanceEntry.builder()
                .session(session)
                .rosterEntry(roster)
                .status(status)
                .updatedBy(actor)
                .build();
    }

    /** upsert의 "덮기" 쪽 (§13.4) */
    public void changeStatus(AttendanceStatus status, Member actor) {
        this.status = status;
        this.updatedBy = actor;
    }
}
