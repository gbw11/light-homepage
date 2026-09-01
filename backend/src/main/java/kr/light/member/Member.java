package kr.light.member;

import jakarta.persistence.*;
import kr.light.roster.RosterEntry;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * 회원 계정.
 *
 * <p><b>계정은 "교회 명단에서 확인된 사람"을 뜻한다</b> (SPEC_API.md §2 v1.3).
 * 계정을 만들려면 반드시 명단 대조를 통과해야 하므로, 승인 절차가 없고
 * 가입하면 즉시 {@link Role#MEMBER}다.
 *
 * <p>{@code login_id}와 {@code kakao_id} 중 최소 하나는 있어야 한다(DB CHECK).
 * 카카오로 가입하면 아이디·비밀번호가 없다 — ⚠️ 카카오 계정을 잃으면 로그인
 * 수단이 사라지고, 전도사가 계정을 지워야 다시 가입할 수 있다 (§8.2).
 *
 * <p>이름은 명단에서 그대로 가져온다 — <b>동명이인 접미사를 포함해서</b>
 * ({@code "김도연a"}). 어디서도 떼지 않는다.
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

    /** 사용자가 정한 아이디 (§9-A 확정). 카카오 전용 계정은 null */
    @Column(name = "login_id", length = 30)
    private String loginId;

    /** BCrypt 해시. 카카오 전용 계정은 null */
    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    @Column(name = "kakao_id", length = 64)
    private String kakaoId;

    /** 명단에서 가져온 이름. 동명이인 접미사를 포함한다 ("김도연a") */
    @Column(nullable = false, length = 50)
    private String name;

    @Column(length = 20)
    private String phone;

    /**
     * 이 계정의 근거가 된 명단 행.
     *
     * <p>계정 하나당 명단 한 행이다(DB UNIQUE). 명단 행이 지워지면 null이 되지만
     * 계정은 남는다 — 명단에서 빠졌다고 로그인이 끊기면 안 되기 때문이다.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "roster_id")
    private RosterEntry rosterEntry;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Role role;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    // ── 생성 ──────────────────────────────────────────────────

    /**
     * 명단 대조를 통과한 사람의 계정 생성 (SPEC_API.md §2.2).
     *
     * <p><b>이름·전화번호는 명단에서 가져온다.</b> 사용자가 다시 입력하지
     * 않는다 — 입력받으면 대조한 값과 저장되는 값이 갈라질 수 있고, 그러면
     * "명단에서 확인된 사람"이라는 계정의 의미가 무너진다.
     *
     * <p><b>역할은 항상 {@link Role#MEMBER}로 시작한다.</b> 호출자가 정하게
     * 두면 가입 요청에 role을 실어 보내는 것만으로 승격이 된다.
     *
     * @param passwordHash 이미 BCrypt로 해싱된 값. <b>평문을 넘기지 말 것.</b>
     */
    public static Member registerFromRoster(RosterEntry roster, String loginId, String passwordHash) {
        return Member.builder()
                .loginId(loginId)
                .passwordHash(passwordHash)
                .name(roster.getName())
                .phone(roster.getPhoneDisplay())
                .rosterEntry(roster)
                .role(Role.MEMBER)
                .build();
    }

    /**
     * 카카오로 가입 (SPEC_API.md §2.8).
     *
     * <p>명단 대조를 건너뛸 수는 없다 — 카카오는 이름·생년월일·전화번호를
     * 주지 않으므로 {@code registrationToken}이 반드시 있어야 한다.
     */
    public static Member registerFromRosterWithKakao(RosterEntry roster, String kakaoId) {
        return Member.builder()
                .kakaoId(kakaoId)
                .name(roster.getName())
                .phone(roster.getPhoneDisplay())
                .rosterEntry(roster)
                .role(Role.MEMBER)
                .build();
    }

    // ── 상태 변경 ─────────────────────────────────────────────

    /**
     * 역할 변경 (SPEC_API.md §8.3).
     *
     * <p>⚠️ <b>{@code MEMBER ↔ LEADER}만 허용한다</b> (FR-ADM-04). PASTOR 부여를
     * API로 열면 전도사 계정이 조용히 늘어나는 사고가 가능해진다. 전도사 임명이
     * 필요하면 DB에서 직접 한다 — 드물고, 되돌리기 어려운 일이다.
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

    /** 연락처 변경 (SPEC_API.md §2.10). 이름은 바꿀 수 없다 — 명단에서 온 값이다 */
    public void changePhone(String phone) {
        this.phone = phone;
    }

    /**
     * 비밀번호 설정 — 재설정(§2.9)·변경(§2.11) 공용.
     *
     * @param passwordHash 이미 BCrypt로 해싱된 값. <b>평문을 넘기지 말 것.</b>
     */
    public void changePassword(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    // ── 조회 ──────────────────────────────────────────────────

    /** 아이디·비밀번호로 로그인할 수 있는 계정인가 (카카오 전용이면 false) */
    public boolean hasPasswordLogin() {
        return loginId != null && passwordHash != null;
    }
}
