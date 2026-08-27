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

    // ── 생성 ──────────────────────────────────────────────────

    /**
     * 이메일 가입 (SPEC_API.md §2.1).
     *
     * <p><b>역할은 항상 {@link Role#PENDING}으로 시작한다.</b> 호출자가 역할을
     * 정하게 두면 가입 요청에 role을 실어 보내는 것만으로 승격이 된다.
     *
     * @param passwordHash 이미 BCrypt로 해싱된 값. <b>평문을 넘기지 말 것.</b>
     */
    public static Member signUpWithEmail(String name, String email, String passwordHash,
                                         String phone, String village) {
        return Member.builder()
                .name(name)
                .email(email)
                .passwordHash(passwordHash)
                .phone(phone)
                .village(village)
                .role(Role.PENDING)
                .build();
    }

    // ── 조회 ──────────────────────────────────────────────────

    /**
     * 실명·연락처·마을이 모두 채워졌는가 (SPEC_API.md §2.2 {@code profileComplete}).
     *
     * <p>이메일 가입은 셋 다 필수라 항상 true다. <b>카카오 가입에서 갈린다</b> —
     * 카카오는 닉네임만 주므로 실명·연락처·마을을 따로 받아야 하고, 그 전까지
     * FE가 {@code /signup/complete}로 보낸다 (SPEC_API.md §2.7·§2.8).
     */
    public boolean isProfileComplete() {
        return hasText(name) && hasText(phone) && hasText(village);
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
