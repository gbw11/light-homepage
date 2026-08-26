package kr.light.meeting;

import jakarta.persistence.*;
import kr.light.member.Member;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * 월례회 자료 열람 로그.
 *
 * <p>유출이 발생했을 때 워터마크에 찍힌 정보와 대조하는 근거다.
 * 스크린샷 자체는 어떤 방법으로도 막을 수 없으므로, 목표는 "기술적 차단"이
 * 아니라 "쉬운 유출 차단 + 유출 시 추적"이다 (BACKEND_TASKS.md §7.1).
 */
@Entity
@Table(name = "meeting_doc_views")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class MeetingDocView {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "doc_id", nullable = false)
    private MeetingDoc doc;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(name = "page_no", nullable = false)
    private int pageNo;

    @CreationTimestamp
    @Column(name = "viewed_at", nullable = false, updatable = false)
    private Instant viewedAt;

    /** IPv6 최대 45자 */
    @Column(length = 45)
    private String ip;

    @Column(name = "user_agent", length = 300)
    private String userAgent;
}
