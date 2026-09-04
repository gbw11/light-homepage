package kr.light.photo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

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
}
