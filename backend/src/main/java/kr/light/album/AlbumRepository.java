package kr.light.album;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface AlbumRepository extends JpaRepository<Album, Long> {

    /** 목록 — 행사일이 최근인 것부터 (SPEC_API.md §6.1) */
    Page<Album> findAllByOrderByEventDateDescIdDesc(Pageable pageable);

    /**
     * 용량 회수 대상 후보 — 행사일이 오래된 것부터 (SPEC_API.md §6.11).
     *
     * <p>⚠️ <b>{@code eventDate}가 없는 앨범은 뽑지 않는다.</b> 언제 찍은
     * 것인지 모르는 앨범을 "오래됐다"고 판단할 근거가 없다. 지우려면 임원이
     * {@code DELETE /api/albums/{id}}로 직접 지정해야 한다.
     *
     * <p>업로드일({@code photos.created_at})이 아니라 <b>행사일</b>로 정렬한다 —
     * 작년 행사를 올해 뒤늦게 올린 앨범이 "최신"으로 잡히면 안 된다.
     */
    @Query("select a from Album a where a.eventDate is not null order by a.eventDate asc, a.id asc")
    List<Album> findOldestDated(Pageable pageable);
}
