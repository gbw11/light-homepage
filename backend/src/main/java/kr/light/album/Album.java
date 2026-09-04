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

    /**
     * 대표 사진 지정 (§6.1 {@code coverThumbUrl}).
     *
     * <p>첫 사진이 커밋될 때 자동으로 채운다 — 임원이 따로 고르게 하면
     * 안 고르는 앨범이 생기고, 목록에서 그 칸만 빈다.
     */
    public void setCoverPhotoIfAbsent(Photo photo) {
        if (this.coverPhoto == null) {
            this.coverPhoto = photo;
        }
    }

    /**
     * ⚠️ 사진을 지우기 <b>전에</b> 불러야 한다. {@code albums.cover_photo_id}가
     * {@code photos}를 가리키고 있어, 사진을 먼저 지우면 FK 위반이 난다.
     */
    public void clearCoverPhoto() {
        this.coverPhoto = null;
    }
}
