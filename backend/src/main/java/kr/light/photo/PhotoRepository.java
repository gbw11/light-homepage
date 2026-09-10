package kr.light.photo;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

public interface PhotoRepository extends JpaRepository<Photo, Long> {

    /**
     * 사진첩이 차지하는 바이트 (SPEC_API.md §8.5).
     *
     * <p>⚠️ {@code PENDING}은 세지 않는다. {@code size_bytes}가 커밋(§6.6)
     * 시점에 실측값으로 채워지므로 PENDING 행의 값은 0이고, 더해도 의미가 없다.
     *
     * <p>그래서 <b>업로드됐지만 커밋되지 않은 객체는 이 합계에 없다.</b> 그쪽은
     * 24시간 뒤 정리 배치가 지운다(§6.5). 정리 배치가 죽으면 이 합계가 실제보다
     * 작아지는데, 그건 카운터가 아니라 배치로 막는 문제다.
     */
    @Query("select coalesce(sum(p.sizeBytes), 0) from Photo p where p.status = kr.light.photo.PhotoStatus.COMMITTED")
    long sumCommittedSizeBytes();

    long countByStatus(PhotoStatus status);

    // ── §6.4 커서 페이징 ─────────────────────────────────────────────

    /**
     * 앨범의 사진 — <b>커밋된 것만</b>, id 오름차순 (§6.4).
     *
     * <p>⚠️ {@code PENDING}은 내보내지 않는다. URL만 발급되고 실제로는 올라오지
     * 않았을 수 있어, 목록에 넣으면 <b>깨진 이미지</b>가 그리드에 섞인다.
     *
     * <p>커서는 id다. offset 페이징은 앨범 하나에 수백 장이 들어가는 무한
     * 스크롤에서 뒤로 갈수록 느려지고, 중간에 사진이 지워지면 한 장씩 건너뛴다.
     */
    @Query("""
            select p from Photo p
            where p.album.id = :albumId
              and p.status = kr.light.photo.PhotoStatus.COMMITTED
              and p.id > :afterId
            order by p.id asc
            """)
    List<Photo> findPageByAlbum(@Param("albumId") Long albumId,
                                @Param("afterId") Long afterId,
                                Pageable pageable);

    /** 목록의 photoCount용 — 앨범 여러 건을 한 번에 센다 (§6.1) */
    @Query("""
            select p.album.id, count(p)
            from Photo p
            where p.album.id in :albumIds
              and p.status = kr.light.photo.PhotoStatus.COMMITTED
            group by p.album.id
            """)
    List<Object[]> countCommittedByAlbumIds(@Param("albumIds") Collection<Long> albumIds);

    /** 정리 대상 미리보기용 — 앨범별 커밋 용량 합계 (§6.11) */
    @Query("""
            select p.album.id, coalesce(sum(p.sizeBytes), 0)
            from Photo p
            where p.album.id in :albumIds
              and p.status = kr.light.photo.PhotoStatus.COMMITTED
            group by p.album.id
            """)
    List<Object[]> sumCommittedSizeByAlbumIds(@Param("albumIds") Collection<Long> albumIds);

    /** 앨범 삭제 시 R2 키를 모으려면 전부 필요하다 (PENDING 포함) */
    List<Photo> findByAlbumId(Long albumId);

    /**
     * 커밋되지 않은 채 오래된 사진 (§6.5 정리 배치).
     *
     * <p>⚠️ R2에는 이미 올라가 있을 수 있다 — 브라우저가 PUT은 했는데 커밋을
     * 못 부른 경우다. 그래서 행만 지우면 안 되고 <b>R2 객체도 함께</b> 지워야 한다.
     */
    List<Photo> findByStatusAndCreatedAtBefore(PhotoStatus status, Instant createdAt);
}
