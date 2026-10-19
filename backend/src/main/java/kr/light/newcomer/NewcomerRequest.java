package kr.light.newcomer;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.time.LocalDate;

/**
 * 새가족 등록 신청 (공개 폼).
 *
 * <p>⚠️ 개인정보다. 보유기간 1년 후 삭제한다 (SPEC_API.md §8.6).
 * 동의(agreed)가 true가 아니면 애초에 저장하지 않는다.
 */
@Entity
@Table(name = "newcomer_requests")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class NewcomerRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(nullable = false, length = 20)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(length = 10)
    private Gender gender;

    /**
     * 생년월일. V10 이전 신청은 null이다 — 그때는 나이대(age_group)를 받았다.
     * age_group 컬럼은 DB에 남아 있지만 더 이상 읽고 쓰지 않는다 (V10 주석)
     */
    @Column(name = "birth_date")
    private LocalDate birthDate;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Referrer referrer;

    @Column(columnDefinition = "text")
    private String message;

    /** 개인정보 동의 시각 */
    @Column(name = "agreed_at", nullable = false)
    private Instant agreedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
