package kr.light.roster;

import jakarta.persistence.*;
import kr.light.member.Member;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.LocalDate;

/**
 * 교회 등록 명단의 한 사람 (SPEC_API.md §2.1 · §13.3).
 *
 * <p><b>계정이 아니다.</b> 계정을 한 번도 만들지 않은 교인도 여기 있고,
 * 출석부는 그 사람들까지 체크한다 — 출결 대상은 {@code members}가 아니라
 * 이 테이블이다 (§13.3).
 *
 * <h2>이름의 접미사를 떼지 않는다</h2>
 * 명단은 동명이인을 이름 뒤 소문자 알파벳으로 구분한다({@code "김도연a"}).
 * <b>그 알파벳까지가 이름이다.</b> 저장·표시·대조 전부 이 값 그대로 쓴다 —
 * 어딘가에서 한 번이라도 떼면 그 화면에서 두 사람이 같은 사람으로 보인다.
 */
@Entity
@Table(name = "member_roster")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class RosterEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 동명이인 접미사 포함 ("김도연a") */
    @Column(nullable = false, length = 50)
    private String name;

    @Column(name = "birth_date", nullable = false)
    private LocalDate birthDate;

    /** ★ 대조에 쓰는 값. 숫자만 남긴 형태 ({@link kr.light.common.PhoneNumbers}) */
    @Column(name = "phone_normalized", nullable = false, length = 20)
    private String phoneNormalized;

    /** 사람이 읽고 거는 번호. §8.2에서 전도사가 본인 확인 전화를 걸 때 쓴다 */
    @Column(name = "phone_display", nullable = false, length = 30)
    private String phoneDisplay;

    /** 출석부(§13.3)가 쓴다. 인증에는 쓰이지 않는다 — 명단에 없으면 null */
    @Column(length = 16)
    private String village;

    /** 전출·졸업 등으로 빠진 사람. 지우지 않고 끈다 — 지우면 출석 기록의 대상이 사라진다 */
    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;

    /**
     * 이 행으로 계정을 만든 사람. {@code null}이면 아직 미가입.
     *
     * <p>⚠️ 계정이 삭제되면 DB의 {@code ON DELETE SET NULL}로 이 값이 저절로
     * null이 되어 명단이 다시 열린다 (§8.2 선점 복구 · §2.12 탈퇴). 그래서
     * 가입 가능 여부의 기준은 {@link #claimedAt}이 아니라 <b>이 컬럼</b>이다.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "claimed_by")
    private Member claimedBy;

    /** 언제 가입했는지의 기록용. 판단에 쓰지 않는다 (위 주석) */
    @Column(name = "claimed_at")
    private Instant claimedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /** 이 행으로 계정을 만들 수 있는가 (§2.1) */
    public boolean isClaimable() {
        return active && claimedBy == null;
    }

    public void claimBy(Member member, Instant at) {
        this.claimedBy = member;
        this.claimedAt = at;
    }

    /** 계정 삭제·탈퇴 시 명단을 다시 연다 (§8.2 · §2.12) */
    public void release() {
        this.claimedBy = null;
        this.claimedAt = null;
    }

    /**
     * 재임포트 시 갱신되는 값.
     *
     * <p>이름·생년월일·전화번호는 <b>바꾸지 않는다</b> — 그 셋이 사람의 식별자라
     * 바뀌면 다른 사람이다. 실제로 바뀌었다면 새 행이고, 옛 행은
     * {@link #deactivate()} 대상이다.
     */
    public void refresh(String phoneDisplay, String village) {
        this.phoneDisplay = phoneDisplay;
        this.village = village;
        this.active = true;
    }

    public void deactivate() {
        this.active = false;
    }
}
