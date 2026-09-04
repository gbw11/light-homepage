package kr.light.album;

import kr.light.common.ApiException;
import kr.light.common.CursorResponse;
import kr.light.common.PageResponse;
import kr.light.member.Member;
import kr.light.photo.Photo;
import kr.light.photo.PhotoRepository;
import kr.light.photo.PhotoResponse;
import kr.light.storage.R2Client;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 사진첩 — 앨범과 사진 목록 (SPEC_API.md §6.1~§6.4).
 *
 * <p><b>⚠️ 열람은 회원(M)부터다.</b> §6 본문에는 아직 {@code G}로 적혀 있지만
 * <b>§10 인가 매트릭스(테스트 기준)가 401</b>이고, 2026-08-31 "열람 M 복귀"
 * 결정이 사진첩을 명시하고 있다. 본문 표기가 그 결정 때 갱신되지 않은 것이라
 * 매트릭스를 따른다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AlbumService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    /**
     * 사진 목록 한 번에 가져오는 장수.
     *
     * <p>그리드가 무한 스크롤이라 한 번에 너무 적으면 요청이 잦고, 너무 많으면
     * presigned URL을 그만큼 만들어야 한다(장당 2개).
     */
    private static final int DEFAULT_PHOTO_SIZE = 40;
    private static final int MAX_PHOTO_SIZE = 100;

    private final AlbumRepository albumRepository;
    private final PhotoRepository photoRepository;
    private final R2Client r2Client;

    // ── §6.1 앨범 목록 ───────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PageResponse<AlbumSummaryResponse> list(int page, int size) {
        Page<Album> albums = albumRepository.findAllByOrderByEventDateDescIdDesc(
                PageRequest.of(page, size));

        // 앨범마다 세면 페이지당 20번의 추가 쿼리가 나간다
        Map<Long, Long> counts = countsFor(albums.getContent());

        return PageResponse.of(albums, album -> new AlbumSummaryResponse(
                String.valueOf(album.getId()),
                album.getTitle(),
                album.getEventDate(),
                counts.getOrDefault(album.getId(), 0L),
                coverThumbUrlOf(album)));
    }

    // ── §6.2 생성 ────────────────────────────────────────────────────

    @Transactional
    public String create(AlbumCreateRequest request, Member actor) {
        Album saved = albumRepository.save(Album.builder()
                .title(request.title().trim())
                .eventDate(request.eventDate())
                .createdBy(actor)
                .build());
        log.info("앨범 생성: id={} title={}", saved.getId(), saved.getTitle());
        return String.valueOf(saved.getId());
    }

    // ── §6.3 삭제 ────────────────────────────────────────────────────

    /**
     * 앨범 삭제 — <b>사진 행과 R2 객체를 모두</b> 지운다 (§6.3).
     *
     * <p>⚠️ {@code PENDING}까지 지운다. 커밋되지 않았어도 브라우저가 PUT은
     * 끝냈을 수 있어, R2에 객체가 남아 있을 수 있다. 남기면 아무도 그것을
     * 가리키지 않는 <b>고아 객체</b>가 되어 용량이 조용히 샌다.
     */
    @Transactional
    public void delete(Long albumId) {
        Album album = find(albumId);
        List<Photo> photos = photoRepository.findByAlbumId(albumId);

        r2Client.deleteAll(photos.stream()
                .flatMap(photo -> java.util.stream.Stream.of(
                        photo.getR2KeyView(), photo.getR2KeyThumb()))
                .toList());

        // ⚠️ 대표 사진 참조를 먼저 끊는다. albums.cover_photo_id가 photos를
        //    가리키고 있어, 사진을 먼저 지우면 FK 위반이 난다.
        album.clearCoverPhoto();
        albumRepository.saveAndFlush(album);

        photoRepository.deleteAll(photos);
        albumRepository.delete(album);
        log.info("앨범 삭제: id={} photos={}", albumId, photos.size());
    }

    // ── §6.4 사진 목록 (커서) ────────────────────────────────────────

    /**
     * 앨범의 사진 — 커서 페이징.
     *
     * <p>커서는 마지막으로 받은 사진의 id다. offset 페이징은 수백 장 무한
     * 스크롤에서 뒤로 갈수록 느려지고, 중간에 한 장이 지워지면 다음 페이지가
     * 한 장 밀려 <b>사진 하나를 건너뛴다.</b>
     */
    @Transactional(readOnly = true)
    public CursorResponse<PhotoResponse> photos(Long albumId, String cursor, Integer size) {
        find(albumId);   // 없는 앨범이면 404

        int limit = normalizePhotoSize(size);
        long afterId = PhotoCursor.decode(cursor);

        // 한 장 더 읽어 "다음이 있는지"를 판단한다 — count 쿼리를 한 번 아낀다
        List<Photo> found = photoRepository.findPageByAlbum(
                albumId, afterId, PageRequest.of(0, limit + 1));

        boolean hasNext = found.size() > limit;
        List<Photo> pageItems = hasNext ? found.subList(0, limit) : found;

        List<PhotoResponse> items = pageItems.stream()
                .map(photo -> new PhotoResponse(
                        String.valueOf(photo.getId()),
                        r2Client.presignedGetUrl(photo.getR2KeyThumb()),
                        r2Client.presignedGetUrl(photo.getR2KeyView()),
                        photo.getWidth(),
                        photo.getHeight(),
                        photo.getTakenAt()))
                .toList();

        return hasNext
                ? CursorResponse.of(items,
                        PhotoCursor.encode(pageItems.get(pageItems.size() - 1).getId()))
                : CursorResponse.last(items);
    }

    // ── 보조 ─────────────────────────────────────────────────────────

    public Album find(Long albumId) {
        return albumRepository.findById(albumId).orElseThrow(ApiException::notFound);
    }

    private Map<Long, Long> countsFor(List<Album> albums) {
        if (albums.isEmpty()) {
            return Map.of();
        }
        List<Long> ids = albums.stream().map(Album::getId).toList();

        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : photoRepository.countCommittedByAlbumIds(ids)) {
            counts.put((Long) row[0], ((Number) row[1]).longValue());
        }
        return counts;
    }

    /** 사진이 한 장도 없는 앨범은 null이다 (§6.1) */
    private String coverThumbUrlOf(Album album) {
        Photo cover = album.getCoverPhoto();
        return cover == null ? null : r2Client.presignedGetUrl(cover.getR2KeyThumb());
    }

    static int normalizePage(Integer page) {
        return (page == null || page < 0) ? 0 : page;
    }

    static int normalizeSize(Integer size) {
        if (size == null || size < 1) {
            return DEFAULT_SIZE;
        }
        return Math.min(size, MAX_SIZE);
    }

    static int normalizePhotoSize(Integer size) {
        if (size == null || size < 1) {
            return DEFAULT_PHOTO_SIZE;
        }
        return Math.min(size, MAX_PHOTO_SIZE);
    }
}
