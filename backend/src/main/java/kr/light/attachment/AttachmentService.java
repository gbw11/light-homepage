package kr.light.attachment;

import kr.light.common.ApiException;
import kr.light.member.Role;
import kr.light.post.Post;
import kr.light.post.PostQueryService;
import kr.light.storage.R2Client;
import kr.light.storage.StorageUsageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * 게시물 첨부파일 (SPEC_API.md §4).
 *
 * <h2>⚠️ 권한을 여기서 다시 판단하지 않는다</h2>
 * 첨부의 열람 권한은 <b>원글의 권한</b>이다 (§4.2). 그 판단은
 * {@link PostQueryService#assertVisible}이 이미 하고 있고, 여기서 같은 규칙을
 * 다시 쓰면 <b>두 곳이 언젠가 어긋난다</b> — 그러면 예산안 첨부가 회의록
 * 규칙으로 열리는 식의 사고가 난다. 관문을 하나로 유지한다.
 *
 * <h2>파일 주소를 아는 것만으로 열려서는 안 된다</h2>
 * 첨부 id로 요청이 올 때마다 <b>원글의 분류를 다시 확인</b>한다 (§4.2).
 * presigned URL은 그 확인을 통과한 뒤에야 만들어진다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AttachmentService {

    /**
     * 어디에도 연결되지 않은 첨부를 지우기까지 기다리는 시간 (§4.1).
     *
     * <p>업로드는 했는데 글을 저장하지 않고 창을 닫으면 그 행이 남는다.
     * 사진의 {@code PENDING}과 같은 문제이고, 같은 이유로 <b>R2 객체까지</b>
     * 지워야 한다.
     */
    private static final Duration ORPHAN_TTL = Duration.ofHours(24);

    /**
     * 한 파일의 상한.
     *
     * <p>Render 무료 인스턴스가 RAM 512MB다. multipart 임계값을 넘는 부분은
     * 디스크로 흘리지만, 상한이 없으면 디스크와 R2 용량이 한 번에 나간다.
     */
    private static final long MAX_FILE_BYTES = 20L * 1024 * 1024;

    private final AttachmentRepository attachmentRepository;
    private final PostQueryService postQueryService;
    private final StorageUsageService storageUsageService;
    private final R2Client r2Client;

    // ── §4.1 업로드 ──────────────────────────────────────────────────

    /**
     * 첨부 업로드. 이 시점에는 <b>어느 글에도 연결되지 않는다</b> —
     * 글을 저장할 때 {@code attachmentIds}로 연결된다 (§4.1).
     */
    @Transactional
    public Uploaded upload(MultipartFile file) {
        validate(file);
        storageUsageService.assertCanUpload(file.getSize());

        // 키에 id가 들어가는데 id는 DB가 채우므로 저장을 먼저 한다
        Attachment attachment = attachmentRepository.saveAndFlush(Attachment.builder()
                .r2Key("")
                .filename(safeFilename(file.getOriginalFilename()))
                .contentType(file.getContentType())
                .sizeBytes(file.getSize())
                .sortOrder(0)
                .build());

        attachment.assignKey("attachments/%d/%s".formatted(
                attachment.getId(), attachment.getFilename()));
        r2Client.put(attachment.getR2Key(), file);

        log.info("첨부 업로드: id={} size={}", attachment.getId(), file.getSize());
        return new Uploaded(String.valueOf(attachment.getId()),
                attachment.getFilename(), attachment.getSizeBytes());
    }

    // ── §4.2 다운로드 ────────────────────────────────────────────────

    /**
     * 내려받기용 URL — <b>원글의 권한을 상속</b>한다 (§4.2).
     *
     * <p>권한이 없으면 원글과 마찬가지로 <b>404</b>다 (존재를 숨긴다).
     *
     * @param role 비로그인이면 null
     */
    @Transactional(readOnly = true)
    public String downloadUrl(Long attachmentId, Role role) {
        Attachment attachment = attachmentRepository.findById(attachmentId)
                .orElseThrow(ApiException::notFound);

        Post post = attachment.getPost();
        if (post == null) {
            // 아직 글에 연결되지 않았거나 주보 첨부다. 어느 쪽이든 이 경로로
            // 열지 않는다 — 주보는 §5가 자기 권한으로 다룬다.
            throw ApiException.notFound();
        }

        // ★ 관문은 하나다. 여기서 규칙을 다시 쓰지 않는다
        postQueryService.assertVisible(post.getCategory(), role);

        return r2Client.presignedDownloadUrl(attachment.getR2Key(), attachment.getFilename());
    }

    // ── 미연결 첨부 정리 (§4.1) ──────────────────────────────────────

    /**
     * 24시간 넘게 어느 글에도 연결되지 않은 첨부를 지운다.
     *
     * <p>⚠️ <b>행만 지우면 안 된다.</b> R2에는 이미 올라가 있다 — 업로드가
     * 끝난 뒤 글을 저장하지 않은 경우이기 때문이다. 남기면 아무도 가리키지
     * 않는 객체가 되어 용량이 조용히 새고, DB 합계로 세는 용량 화면(§8.5)에
     * 잡히지도 않는다.
     */
    @Scheduled(fixedDelayString = "${app.attachment.orphan-cleanup-interval:PT1H}")
    @Transactional
    public void cleanUpOrphans() {
        Instant cutoff = Instant.now().minus(ORPHAN_TTL);
        List<Attachment> orphans = attachmentRepository.findOrphansCreatedBefore(cutoff);

        if (orphans.isEmpty()) {
            return;
        }
        r2Client.deleteAll(orphans.stream()
                .map(Attachment::getR2Key)
                .filter(key -> key != null && !key.isBlank())
                .toList());

        attachmentRepository.deleteAll(orphans);
        log.info("미연결 첨부 정리: {}건 (기준 {})", orphans.size(), cutoff);
    }

    // ── 보조 ─────────────────────────────────────────────────────────

    /** §4.1 응답 */
    public record Uploaded(String id, String filename, long sizeBytes) {
    }

    private void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.validation("file", "파일을 선택해 주세요.");
        }
        if (file.getSize() > MAX_FILE_BYTES) {
            throw ApiException.validation("file",
                    "파일은 %dMB까지 올릴 수 있습니다.".formatted(MAX_FILE_BYTES / 1024 / 1024));
        }
    }

    /**
     * 저장할 파일명.
     *
     * <p>⚠️ <b>원본 파일명을 그대로 쓰지 않는다.</b> 사용자가 정하는 값이라
     * 경로 구분자({@code /}, {@code \})나 상위 경로({@code ..})가 섞이면 R2 키가
     * 엉뚱한 곳을 가리킨다. 다만 이름 자체는 사람이 알아봐야 하는 값이라
     * (다운로드될 때 그 이름으로 저장된다) 지우지 않고 <b>경로 요소만</b> 없앤다.
     */
    private static String safeFilename(String original) {
        if (original == null || original.isBlank()) {
            return "attachment";
        }
        String name = original.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1);   // 경로 제거
        name = name.replace("..", "").trim();
        return name.isBlank() ? "attachment" : name;
    }
}
