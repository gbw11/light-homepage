package kr.light.album;

import jakarta.persistence.*;
import kr.light.member.Member;
import kr.light.photo.Photo;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.time.LocalDate;

/**
 * 사진 앨범.
 *
 * <p>⚠️ 삭제 시 사진 행과 R2 객체를 모두 지워야 한다. 고아 객체가 남으면
 * 용량이 조용히 샌다 (SPEC_API.md §6.3).
 */
@Entity
@Table(name = "albums")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class Album {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(name = "event_date")
    private LocalDate eventDate;

    /** 대표 사진. 그 사진이 지워지면 null이 된다 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cover_photo_id")
    private Photo coverPhoto;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private Member createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
