package kr.light.auth;

import jakarta.persistence.*;
import kr.light.roster.RosterEntry;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * 명단 대조를 통과했다는 증표 (SPEC_API.md §2.1 → §2.2).
 *
 * <p><b>1회용 · 5분 만료.</b> 이것만 있으면 그 명단 행으로 계정을 만들 수 있다 —
 * 즉 <b>남의 이름으로 가입할 수 있는 값</b>이라 평문을 저장하지 않는다.
 *
 * <p>수명이 짧은 이유: 대조에서 가입 완료까지는 아이디·비밀번호를 정하는
 * 한 화면뿐이다. 길게 잡을 이유가 없고, 길수록 브라우저 기록·로그에 남은
 * 값이 쓸모 있는 시간이 늘어난다.
 */
@Entity
@Table(name = "registration_tokens")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class RegistrationToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "roster_id", nullable = false)
    private RosterEntry rosterEntry;

    /** ★ SHA-256. 평문 저장 금지 */
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
