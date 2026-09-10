package kr.light.album;

import kr.light.photo.Photo;
import kr.light.photo.PhotoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 오래된 앨범을 지워 R2 용량을 회수한다 (SPEC_API.md §6.11 · FR-PHO-11).
 *
 * <h2>왜 "보관 없이 삭제"인가</h2>
 * 원래 요구는 "내려받아 외부 보관 후 제거"였다. 그런데 사진첩은 추억을 다시
 * 보는 곳이 아니라 <b>"이런 활동을 했다"를 보여주는 홍보용</b>이고(2026-09-10),
 * "외부 보관" 위치가 정해진 적이 없다. 그래서 보관 단계를 빼고 삭제만 한다
 * ({@code docs/records/DECISIONS.md} 2026-09-10).
 *
 * <h2>⚠️ 되돌릴 수 없다</h2>
 * R2 객체를 지우므로 복구 경로가 없다. 그래서 두 가지를 지킨다.
 * <ul>
 *   <li><b>미리보기와 실행을 나눈다.</b> 무엇이 지워지는지 보고 누르게 한다</li>
 *   <li><b>실행은 개수가 아니라 id로 받는다.</b> {@link AlbumPurgeRequest} 참고 —
 *       그 사이에 앨범이 새로 생겨도 화면에서 본 것과 다른 것이 지워지지 않는다</li>
 * </ul>
 *
 * <h2>지금은 수동이다</h2>
 * {@code @Scheduled}를 붙이지 않았다. 자동으로 돌면 <b>예고 없이 사라지고</b>
 * 아무도 언제 무엇이 지워졌는지 모른다(로그만 남는다). 그리고 Render 무료
 * 인스턴스는 유휴 시 잠들어 주기를 지키지도 못한다
 * ({@code PhotoService.cleanUpPending()}의 같은 주석 참고).
 *
 * <p>나중에 손이 너무 간다고 판단되면 {@link #purge}에 {@code @Scheduled}와
 * 임계 판정을 얹으면 된다 — 반대 방향(자동만 만들기)은 "지금 당장 비워야 하는"
 * 상황에 손을 쓸 수 없어 택하지 않았다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AlbumPurgeService {

    /** 미리보기 기본·최대 개수. 한 번에 수십 개를 지우는 화면은 사고를 부른다 */
    private static final int DEFAULT_COUNT = 5;
    private static final int MAX_COUNT = 20;

    private final AlbumRepository albumRepository;
    private final PhotoRepository photoRepository;
    private final AlbumService albumService;

    /**
     * 정리 대상 미리보기 — 행사일이 오래된 것부터.
     *
     * <p>⚠️ 이 호출은 <b>아무것도 지우지 않는다.</b>
     */
    @Transactional(readOnly = true)
    public List<AlbumPurgeCandidate> candidates(Integer count) {
        List<Album> albums = albumRepository.findOldestDated(
                PageRequest.of(0, normalizeCount(count)));
        if (albums.isEmpty()) {
            return List.of();
        }

        List<Long> ids = albums.stream().map(Album::getId).toList();
        Map<Long, Long> counts = countsFor(ids);
        Map<Long, Long> sizes = sizesFor(ids);

        return albums.stream()
                .map(album -> new AlbumPurgeCandidate(
                        String.valueOf(album.getId()),
                        album.getTitle(),
                        album.getEventDate(),
                        counts.getOrDefault(album.getId(), 0L),
                        sizes.getOrDefault(album.getId(), 0L)))
                .toList();
    }

    /**
     * 지정한 앨범들을 지운다 — 사진 · R2 객체 · DB 행.
     *
     * <p>★ 삭제 자체는 {@link AlbumService#delete}에 맡긴다. 그쪽이 이미
     * <b>R2 객체를 먼저 지우고 DB 행을 나중에</b> 지우는 순서와, 대표 사진
     * FK를 먼저 끊는 처리를 갖고 있다. 여기서 다시 구현하면 두 경로가
     * 갈라져 한쪽만 고쳐지는 일이 생긴다.
     *
     * <p>없는 id가 섞여 있으면 {@code NOT_FOUND}로 <b>전체가 실패한다</b> —
     * 되돌릴 수 없는 동작이라, 일부만 지워진 상태로 끝나는 것보다 아무것도
     * 지우지 않는 편이 낫다.
     */
    @Transactional
    public AlbumPurgeResponse purge(List<Long> albumIds) {
        // 미리 세어둔다 — 지운 뒤에는 셀 수 없다
        Map<Long, Long> sizes = sizesFor(albumIds);
        int photos = 0;
        long freed = 0;

        for (Long albumId : albumIds) {
            albumService.find(albumId);   // 없으면 404 — 전체 롤백
            photos += photoRepository.findByAlbumId(albumId).size();
            freed += sizes.getOrDefault(albumId, 0L);
            albumService.delete(albumId);
        }

        log.info("앨범 정리: {}개 · 사진 {}장 · {}바이트 회수 (ids={})",
                albumIds.size(), photos, freed, albumIds);
        return new AlbumPurgeResponse(albumIds.size(), photos, freed);
    }

    // ── 보조 ─────────────────────────────────────────────────────────

    private Map<Long, Long> countsFor(List<Long> ids) {
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : photoRepository.countCommittedByAlbumIds(ids)) {
            counts.put((Long) row[0], ((Number) row[1]).longValue());
        }
        return counts;
    }

    private Map<Long, Long> sizesFor(List<Long> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<Long, Long> sizes = new HashMap<>();
        for (Object[] row : photoRepository.sumCommittedSizeByAlbumIds(ids)) {
            sizes.put((Long) row[0], ((Number) row[1]).longValue());
        }
        return sizes;
    }

    static int normalizeCount(Integer count) {
        if (count == null || count < 1) {
            return DEFAULT_COUNT;
        }
        return Math.min(count, MAX_COUNT);
    }
}
