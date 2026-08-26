package kr.light.member;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * 회원.
 *
 * <p>email과 kakao_id 중 최소 하나는 존재해야 한다(DB CHECK 제약).
 * 카카오 비즈 앱 전환 전에는 이메일을 받을 수 없어 email이 null인 계정이 생긴다.
 */
@Entity
@Table(name = "members")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class Member {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 카카오 전용 계정은 null */
    @Column(length = 255)
    private String email;

    /** BCrypt 해시. 카카오 전용 계정은 null */
    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    @Column(name = "kakao_id", length = 64)
    private String kakaoId;

    /** 실명. 카카오 닉네임이 아니라 앱에서 직접 받는다 (승인 대조용) */
    @Column(nullable = false, length = 50)
    private String name;

    @Column(length = 20)
    private String phone;

    /** '1'~'9' | 'newcomer' */
    @Column(length = 16)
    private String village;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Role role;

    @Column(name = "approved_at")
    private Instant approvedAt;

    /** 누가 승인했는지. 승인자가 탈퇴하면 null로 남는다 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by")
    private Member approvedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
