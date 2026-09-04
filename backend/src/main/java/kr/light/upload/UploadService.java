package kr.light.upload;

import kr.light.album.Album;
import kr.light.album.AlbumRepository;
import kr.light.album.AlbumService;
import kr.light.common.ApiException;
import kr.light.photo.Photo;
import kr.light.photo.PhotoRepository;
import kr.light.photo.PhotoStatus;
import kr.light.storage.R2Client;
import kr.light.storage.R2OperationClass;
import kr.light.storage.R2OperationRecorder;
import kr.light.storage.StorageUsageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * 사진 업로드 (SPEC_API.md §6.5 · §6.6).
 *
 * <h2>파일이 이 서버를 통과하지 않는다</h2>
 * 주보(§5.4)와 정반대다. 브라우저가 R2로 <b>직접</b> 올리고, 우리는 허가증
 * (presigned PUT URL)만 발급한다 — 무료 인스턴스(RAM 512MB)에서 수백 장의
 * 파일 스트림을 받으면 메모리가 터진다 (ARCHITECTURE.md §7.3).
 *
 * <h2>그래서 두 단계다</h2>
 * <pre>
 *   issue  → photos 행 생성(PENDING) + PUT URL 발급
 *   (브라우저가 R2로 직접 전송)
 *   commit → R2에 실제로 있는지 확인 → COMMITTED + 실측 크기 기록
 * </pre>
 *
 * <p>★ <b>커밋에서 클라이언트가 말한 크기를 믿지 않는다.</b> 커밋 요청도
 * 브라우저가 보내는 것이라, 업로드가 실패했거나 아예 하지 않았어도 부를 수
 * 있다. R2에 직접 물어(HeadObject) 없으면 실패로 돌려준다 — 그러지 않으면
 * 목록에 <b>깨진 이미지</b>가 뜨고 용량 집계가 틀어진다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UploadService {

    /**
     * presigned PUT URL 수명 — 15분 (§6.5).
     *
     * <p>열람용(10분)보다 길다. 200장을 배치로 나눠 올리는 동안 앞쪽 URL이
     * 만료되면 재발급 왕복이 늘어난다.
     */
    static final Duration PUT_TTL = Duration.ofMinutes(15);

    private static final String CONTENT_TYPE = "image/webp";

    private final AlbumService albumService;
    private final AlbumRepository albumRepository;
    private final PhotoRepository photoRepository;
    private final StorageUsageService storageUsageService;
    private final R2Client r2Client;
    private final R2OperationRecorder recorder;

    // ── §6.5 발급 ────────────────────────────────────────────────────

    @Transactional
    public List<UploadTicket> issue(UploadIssueRequest request) {
        Album album = albumService.find(parseId(request.albumId(), "albumId"));

        // ⚠️ 발급 **전에** 용량을 본다. URL을 주고 나면 우리는 브라우저가
        //    올리는 것을 막을 수단이 없다 — 그 시점엔 이미 늦다.
        long incoming = request.files().stream()
                .mapToLong(UploadIssueRequest.File::totalBytes)
                .sum();
        storageUsageService.assertCanUpload(incoming);

        List<UploadTicket> tickets = new ArrayList<>();
        for (UploadIssueRequest.File file : request.files()) {
            // size_bytes는 0으로 둔다 — 커밋 때 R2 실측값으로 채운다.
            // 여기서 클라이언트가 말한 값을 넣으면, 올리지도 않은 용량이
            // 집계에 잡혀 "쓰지도 않은 공간"이 한도를 먹는다.
            Photo photo = photoRepository.save(Photo.builder()
                    .album(album)
                    .r2KeyView("")      // id를 알아야 키를 만든다 — 아래에서 채운다
                    .r2KeyThumb("")
                    .width(file.width())
                    .height(file.height())
                    .takenAt(file.takenAt())
                    .sizeBytes(0)
                    .status(PhotoStatus.PENDING)
                    .build());
            photoRepository.flush();

            photo.assignKeys(keyOf(album.getId(), photo.getId(), "view"),
                    keyOf(album.getId(), photo.getId(), "thumb"));

            tickets.add(new UploadTicket(
                    file.clientId(),
                    String.valueOf(photo.getId()),
                    r2Client.presignedPutUrl(photo.getR2KeyView(), CONTENT_TYPE, PUT_TTL),
                    r2Client.presignedPutUrl(photo.getR2KeyThumb(), CONTENT_TYPE, PUT_TTL),
                    PUT_TTL.toSeconds()));
        }

        log.info("업로드 URL 발급: album={} files={} bytes={}",
                album.getId(), tickets.size(), incoming);
        return tickets;
    }

    // ── §6.6 확정 ────────────────────────────────────────────────────

    /**
     * 업로드 확정.
     *
     * <p>⚠️ <b>일부 실패를 400으로 만들지 않는다.</b> 20장 중 한 장이
     * 실패했다고 전체를 되돌리면 성공한 19장까지 다시 올려야 한다. 실패한
     * 것만 골라 돌려주고 FE가 그것만 재시도한다 (§6.6).
     */
    @Transactional
    public UploadCommitResponse commit(UploadCommitRequest request) {
        List<String> committed = new ArrayList<>();
        List<UploadCommitResponse.Failure> failed = new ArrayList<>();

        for (String rawId : request.photoIds()) {
            Optional<Photo> found = photoRepository.findById(parseId(rawId, "photoIds"));

            if (found.isEmpty()) {
                failed.add(new UploadCommitResponse.Failure(rawId, "NOT_FOUND"));
                continue;
            }
            Photo photo = found.get();

            if (photo.getStatus() == PhotoStatus.COMMITTED) {
                // 재시도로 같은 요청이 두 번 올 수 있다. 이미 끝난 것을
                // 실패로 돌려주면 FE가 영원히 재시도한다.
                committed.add(rawId);
                continue;
            }

            // ★ R2에 실제로 있는지 물어본다 — 클라이언트 말을 믿지 않는다
            Optional<Long> viewSize = r2Client.objectSize(photo.getR2KeyView());
            Optional<Long> thumbSize = r2Client.objectSize(photo.getR2KeyThumb());

            if (viewSize.isEmpty() || thumbSize.isEmpty()) {
                failed.add(new UploadCommitResponse.Failure(rawId, "OBJECT_NOT_FOUND"));
                continue;
            }

            // ★ 여기서 Class A를 센다. PutObject는 **브라우저가** 보냈으므로 우리는
            //   그 순간을 볼 수 없는데, HeadObject로 객체가 실제로 있는 것을 방금
            //   확인했으니 view·thumb 두 번의 쓰기가 일어났음이 확정된다.
            //   ⚠️ 브라우저가 재시도로 여러 번 PUT한 경우는 세지 못한다 —
            //      이 카운터는 하한이다.
            recorder.record(R2OperationClass.A, 2);

            photo.commit(viewSize.get() + thumbSize.get());
            // 첫 사진이 대표가 된다 — 임원이 따로 고르게 하면 안 고르는 앨범이 생긴다
            photo.getAlbum().setCoverPhotoIfAbsent(photo);
            albumRepository.save(photo.getAlbum());

            committed.add(rawId);
        }

        if (!failed.isEmpty()) {
            log.warn("업로드 확정 일부 실패: 성공 {}건 · 실패 {}건", committed.size(), failed.size());
        }
        return new UploadCommitResponse(committed, failed);
    }

    // ── 보조 ─────────────────────────────────────────────────────────

    /**
     * R2 키.
     *
     * <p>⚠️ 사용자가 준 파일명을 쓰지 않는다. 경로 탈출({@code ../})이나
     * 제어문자가 섞일 수 있고, 키는 우리가 만들면 그만이다.
     */
    private static String keyOf(Long albumId, Long photoId, String kind) {
        return "albums/%d/%d-%s.webp".formatted(albumId, photoId, kind);
    }

    /** FE는 id를 문자열로 다룬다 (§1.3) */
    private static Long parseId(String value, String field) {
        try {
            return Long.parseLong(value.trim());
        } catch (RuntimeException e) {
            throw ApiException.validation(field, "잘못된 id입니다.");
        }
    }
}
