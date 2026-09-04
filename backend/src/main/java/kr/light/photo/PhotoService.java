package kr.light.photo;

import kr.light.album.Album;
import kr.light.album.AlbumRepository;
import kr.light.common.ApiException;
import kr.light.storage.R2Client;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * 사진 개별 처리 (SPEC_API.md §6.7 · §6.9) + 미커밋 정리 배치.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PhotoService {

    /**
     * 커밋되지 않은 사진을 지우기까지 기다리는 시간 (§6.5).
     *
     * <p>업로드 중에 브라우저를 닫거나 네트워크가 끊기면 {@code PENDING} 행이
     * 남는다. 너무 짧으면 <b>느린 회선에서 올리는 중인 사진</b>을 지우고, 너무
     * 길면 R2에 고아 객체가 그만큼 오래 남는다.
     */
    private static final Duration PENDING_TTL = Duration.ofHours(24);

    private final PhotoRepository photoRepository;
    private final AlbumRepository albumRepository;
    private final R2Client r2Client;

    // ── §6.7 개별 다운로드 ───────────────────────────────────────────

    /**
     * 내려받기용 URL (§6.7).
     *
     * <p>컨트롤러가 이 주소로 <b>302 리다이렉트</b>한다. 파일을 우리 서버가
     * 중계하지 않는다 — 전송량과 메모리를 쓰지 않기 위해서다.
     *
     * <p>⚠️ 권한 판단은 <b>이 URL을 만들기 전에</b> 끝나 있어야 한다. 발급된
     * 주소 자체에는 인증이 없다.
     */
    @Transactional(readOnly = true)
    public String downloadUrl(Long photoId) {
        Photo photo = find(photoId);
        // 확대·인쇄용이므로 썸네일이 아니라 2560px 원본을 준다
        return r2Client.presignedGetUrl(photo.getR2KeyView());
    }

    // ── §6.9 삭제 ────────────────────────────────────────────────────

    /** 사진 삭제 — <b>R2 객체까지</b> (§6.9) */
    @Transactional
    public void delete(Long photoId) {
        Photo photo = find(photoId);

        // ⚠️ 대표 사진이면 앨범의 참조를 먼저 끊는다. FK가 걸려 있어
        //    그냥 지우면 위반이 나고, 남겨두면 지워진 사진을 가리킨다.
        Album album = photo.getAlbum();
        if (album.getCoverPhoto() != null
                && album.getCoverPhoto().getId().equals(photoId)) {
            album.clearCoverPhoto();
            albumRepository.saveAndFlush(album);
        }

        r2Client.deleteAll(List.of(photo.getR2KeyView(), photo.getR2KeyThumb()));
        photoRepository.delete(photo);
        log.info("사진 삭제: id={} album={}", photoId, album.getId());
    }

    // ── 미커밋 정리 배치 (§6.5) ──────────────────────────────────────

    /**
     * 24시간 넘게 {@code PENDING}인 사진과 그 R2 객체를 지운다.
     *
     * <p><b>⚠️ 행만 지우면 안 된다.</b> 브라우저가 R2로 PUT은 끝냈는데 커밋을
     * 못 부른 경우, 객체는 이미 올라가 있다. 행만 지우면 <b>아무도 가리키지
     * 않는 객체</b>가 남아 용량이 조용히 샌다 — 그리고 그건 용량 화면(§8.5)의
     * 합계에도 안 잡힌다. DB만 보고 세기 때문이다.
     *
     * <p>한 시간마다 돈다. 자주 돌 이유가 없고, Render 무료 인스턴스는 유휴
     * 시 잠들었다 깨어나므로 정확한 주기를 기대하지 않는다.
     */
    @Scheduled(fixedDelayString = "${app.photo.pending-cleanup-interval:PT1H}")
    @Transactional
    public void cleanUpPending() {
        Instant cutoff = Instant.now().minus(PENDING_TTL);
        List<Photo> stale = photoRepository.findByStatusAndCreatedAtBefore(
                PhotoStatus.PENDING, cutoff);

        if (stale.isEmpty()) {
            return;
        }
        r2Client.deleteAll(stale.stream()
                .flatMap(photo -> java.util.stream.Stream.of(
                        photo.getR2KeyView(), photo.getR2KeyThumb()))
                .filter(key -> key != null && !key.isBlank())
                .toList());

        photoRepository.deleteAll(stale);
        log.info("미커밋 사진 정리: {}건 (기준 {})", stale.size(), cutoff);
    }

    // ── 보조 ─────────────────────────────────────────────────────────

    private Photo find(Long photoId) {
        Photo photo = photoRepository.findById(photoId).orElseThrow(ApiException::notFound);
        if (photo.getStatus() != PhotoStatus.COMMITTED) {
            // 아직 R2에 없을 수 있다. 존재를 알려줄 이유도 없다
            throw ApiException.notFound();
        }
        return photo;
    }
}
