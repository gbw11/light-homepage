package kr.light.auth;

import jakarta.persistence.*;
import kr.light.member.Member;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * 비밀번호 재설정 토큰 — 1회용이며 만료된다.
 *
 * <p>재설정 요청은 계정 존재 여부를 노출하지 않기 위해 항상 204를 반환한다
 * (SPEC_API.md §2.9). 즉 토큰이 발급되지 않아도 응답은 같다.
 */
@Entity
@Table(name = "password_reset_tokens")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class PasswordResetToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(name = "token_hash", nullable = false, length = 255)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    /** 1회용 — 사용 즉시 기록하고 재사용을 막는다 */
    @Column(name = "used_at")
    private Instant usedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public boolean isUsable(Instant now) {
        return usedAt == null && expiresAt.isAfter(now);
    }

    public void markUsed(Instant at) {
        this.usedAt = at;
    }
}
