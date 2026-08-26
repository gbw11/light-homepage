package kr.light.common;

import jakarta.persistence.*;
import kr.light.member.Member;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * 감사 로그 — 권한 변경·회원 승인처럼 나중에 되짚어야 하는 행위를 남긴다.
 *
 * <p>RLS가 없어 애플리케이션이 권한을 전담하므로, 누가 무엇을 바꿨는지
 * 추적할 수 있어야 한다.
 */
@Entity
@Table(name = "audit_logs")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 시스템이 수행한 동작은 null */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    private Member actor;

    /** MEMBER_APPROVE · ROLE_CHANGE 등 */
    @Column(nullable = false, length = 50)
    private String action;

    /** 대상 식별자 */
    @Column(length = 200)
    private String target;

    @Column(columnDefinition = "text")
    private String detail;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
