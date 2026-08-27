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

    // ── 상태 변경 ─────────────────────────────────────────────

    /**
     * 가입 승인 (SPEC_API.md §8.2).
     *
     * <p>누가 언제 승인했는지 남긴다 — 승인은 되돌리기 어렵고 사고가 나면
     * 반드시 추적 대상이 된다. 감사로그와 별개로 회원 행에도 남겨,
     * 로그를 뒤지지 않아도 회원 목록에서 바로 보이게 한다.
     *
     * <p><b>이미 승인된 회원을 다시 승인하지 않는다.</b> 두 번째 호출이
     * {@code approvedAt}을 덮으면 최초 승인 시각이라는 기록이 사라진다.
     */
    public void approve(Member approver, Instant at) {
        if (role != Role.PENDING) {
            throw new IllegalStateException("승인 대기 상태가 아니다: " + role);
        }
        this.role = Role.MEMBER;
        this.approvedAt = at;
        this.approvedBy = approver;
    }

    /**
     * 역할 변경 (SPEC_API.md §8.4).
     *
     * <p>⚠️ <b>{@code MEMBER ↔ LEADER}만 허용한다</b> (FR-ADM-04). PENDING을
     * 여기로 끌어올리면 {@link #approve}가 남기는 승인 기록을 건너뛰게 되고,
     * PASTOR 부여를 API로 열면 전도사 계정이 조용히 늘어나는 사고가 가능해진다.
     * 전도사 임명이 필요하면 DB에서 직접 한다 — 드물고, 되돌리기 어려운 일이다.
     */
    public void changeRole(Role newRole) {
        if (!isAssignableRole(role) || !isAssignableRole(newRole)) {
            throw new IllegalStateException(
                    "MEMBER↔LEADER만 변경할 수 있다: %s → %s".formatted(role, newRole));
        }
        this.role = newRole;
    }

    /** API로 오갈 수 있는 역할인가 */
    public static boolean isAssignableRole(Role role) {
        return role == Role.MEMBER || role == Role.LEADER;
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
