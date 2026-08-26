package kr.light.photo;

import jakarta.persistence.*;
import kr.light.album.Album;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * 사진 — 파일 본체는 R2에 있고 여기에는 메타데이터만 둔다.
 *
 * <p>⚠️ sizeBytes 합계로 용량 한도를 계산한다(80% 경고 · 95% 업로드 차단).
 * R2 API로 매번 실측하면 요청 한도를 낭비한다 (ARCHITECTURE.md §3.2).
 */
@Entity
@Table(name = "photos")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class Photo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "album_id", nullable = false)
    private Album album;

    /** 2560px — 확대·다운로드용 */
    @Column(name = "r2_key_view", nullable = false, length = 500)
    private String r2KeyView;

    /** 640px — 그리드용. 200장 열람 시 전송량 약 16MB */
    @Column(name = "r2_key_thumb", nullable = false, length = 500)
    private String r2KeyThumb;

    private Integer width;

    private Integer height;

    /** view+thumb 합계. 용량 한도 계산의 근거 */
    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Column(name = "taken_at")
    private Instant takenAt;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private PhotoStatus status;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** 업로드 확정 — R2에 실제로 올라간 것을 확인한 뒤 호출한다 */
    public void commit(long actualSizeBytes) {
        this.status = PhotoStatus.COMMITTED;
        this.sizeBytes = actualSizeBytes;
    }
}
