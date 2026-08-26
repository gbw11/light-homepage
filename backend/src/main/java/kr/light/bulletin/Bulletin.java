package kr.light.bulletin;

import jakarta.persistence.*;
import kr.light.member.Member;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.time.LocalDate;

/**
 * 주보. 페이지 이미지들은 attachments가 sort_order로 들고 있다.
 *
 * <p>주보는 글자가 작아 썸네일이 아니라 큰 이미지(장변 2048px)를 바로 제공한다
 * — 사진첩과 로딩 전략이 반대다 (SPEC_API.md §5.1).
 */
@Entity
@Table(name = "bulletins")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class Bulletin {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 같은 날짜로 다시 올리면 DUPLICATE (SPEC_API.md §5.4) */
    @Column(name = "service_date", nullable = false)
    private LocalDate serviceDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by")
    private Member uploadedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
