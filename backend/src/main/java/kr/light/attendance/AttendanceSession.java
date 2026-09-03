package kr.light.attendance;

import jakarta.persistence.*;
import kr.light.member.Member;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.time.LocalDate;

/**
 * 출석 회차 (SPEC_API.md §13.1 · §13.2).
 *
 * <p><b>같은 날짜 + 같은 종류는 하나뿐이다</b>(DB UNIQUE). 실수로 둘이 생기면
 * 출결이 갈라져 "누가 체크했는지"를 알 수 없게 된다.
 */
@Entity
@Table(name = "attendance_sessions")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class AttendanceSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 컬럼명은 session_date다 — {@code date}는 SQL 예약어다. 응답 필드명은 date다 */
    @Column(name = "session_date", nullable = false)
    private LocalDate date;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AttendanceSessionType type;

    @Column(nullable = false, length = 100)
    private String title;

    /** 만든 사람. 탈퇴하면 null로 남는다 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private Member createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public static AttendanceSession create(LocalDate date, AttendanceSessionType type,
                                           String title, Member creator) {
        return AttendanceSession.builder()
                .date(date)
                .type(type)
                .title(title.trim())
                .createdBy(creator)
                .build();
    }
}
