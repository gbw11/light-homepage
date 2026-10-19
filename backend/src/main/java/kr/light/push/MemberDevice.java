package kr.light.push;

import jakarta.persistence.*;
import kr.light.member.Member;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * 푸시를 받을 기기 하나 — 로그인한 앱의 FCM 토큰 (V12, SPEC_API.md §15.2).
 *
 * <p>★ 토큰은 한 사람의 것이다(UNIQUE). 같은 폰에서 다른 사람이 로그인하면
 * {@link #moveTo}로 주인을 옮긴다 — 앞 사람의 회원 알림이 계속 가면 안 된다.
 */
@Entity
@Table(name = "member_devices")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class MemberDevice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id")
    private Member member;

    @Column(nullable = false, length = 4096)
    private String token;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private DevicePlatform platform;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /** 다시 등록됐다 — 주인 · 종류를 덮어쓰고 시각을 새로 찍는다 */
    void moveTo(Member owner, DevicePlatform platform, Instant now) {
        this.member = owner;
        this.platform = platform;
        this.updatedAt = now;
    }
}
