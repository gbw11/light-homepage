package kr.light.bulletin;

import kr.light.attachment.Attachment;
import kr.light.attachment.AttachmentRepository;
import kr.light.common.ApiException;
import kr.light.common.PageResponse;
import kr.light.member.Member;
import kr.light.storage.R2Client;
import kr.light.storage.StorageUsageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.Dimension;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 주보 (SPEC_API.md §5).
 *
 * <p>페이지 이미지는 별도 테이블이 아니라 {@code attachments}에 {@code bulletin_id}로
 * 매달린다 (V1 스키마). {@code sort_order}가 페이지 번호다.
 *
 * <h2>⚠️ 사진첩과 전송 경로가 다르다</h2>
 * 사진은 브라우저가 R2로 직접 올리지만(§6.5), 주보는 <b>Spring을 통과</b>한다.
 * 페이지가 2~4장이라 서버를 거치는 비용이 문제가 아니고, <b>순서를 한 요청
 * 안에서 확정하는 편이 안전</b>하기 때문이다 (FE 계약 주석과 합의된 내용).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BulletinService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    /**
     * 한 주보의 최대 페이지 수.
     *
     * <p>주보는 보통 2~4장이다. 상한이 없으면 실수로 사진첩 폴더를 통째로
     * 올렸을 때 그대로 들어간다 — 용량 가드가 막기 전에 서버 메모리부터 흔든다.
     */
    private static final int MAX_PAGES = 20;

    private final BulletinRepository bulletinRepository;
    private final AttachmentRepository attachmentRepository;
    private final StorageUsageService storageUsageService;
    private final R2Client r2Client;

    // ── §5.2 목록 ────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PageResponse<BulletinSummaryResponse> list(int page, int size) {
        Page<Bulletin> bulletins =
                bulletinRepository.findAllByOrderByServiceDateDescIdDesc(PageRequest.of(page, size));

        // 주보마다 첨부를 따로 읽으면 페이지당 20번의 추가 쿼리가 나간다
        Map<Long, List<Attachment>> pagesByBulletin = pagesOf(bulletins.getContent());

        return PageResponse.of(bulletins, bulletin -> {
            List<Attachment> pages = pagesByBulletin.getOrDefault(bulletin.getId(), List.of());
            return new BulletinSummaryResponse(
                    String.valueOf(bulletin.getId()),
                    bulletin.getServiceDate(),
                    pages.size(),
                    // 1쪽을 목록 이미지로 쓴다 — 별도 썸네일을 만들지 않는다
                    pages.isEmpty() ? null : r2Client.presignedGetUrl(pages.get(0).getR2Key()));
        });
    }

    // ── §5.1 · §5.3 상세 ─────────────────────────────────────────────

    /** 가장 최근 주보. <b>없으면 비어 있다</b> — 계약상 {@code data: null}이다 */
    @Transactional(readOnly = true)
    public Optional<BulletinResponse> latest() {
        return bulletinRepository.findFirstByOrderByServiceDateDescIdDesc().map(this::detailOf);
    }

    @Transactional(readOnly = true)
    public BulletinResponse get(Long id) {
        return detailOf(bulletinRepository.findById(id).orElseThrow(ApiException::notFound));
    }

    // ── §5.4 업로드 ──────────────────────────────────────────────────

    /**
     * 주보 업로드.
     *
     * <p>순서가 곧 페이지 번호다 — 정렬 기준이 따로 없으므로 받은 순서를 그대로 쓴다.
     *
     * @return 만들어진 주보와 페이지 수
     */
    @Transactional
    public Created create(LocalDate serviceDate, List<MultipartFile> pages, Member actor) {
        validate(pages);

        // ⚠️ 용량 검사를 R2에 올리기 **전에** 한다. 올린 뒤에 막으면 이미 용량을 쓴 뒤다.
        storageUsageService.assertCanUpload(totalBytes(pages));

        if (bulletinRepository.existsByServiceDate(serviceDate)) {
            throw duplicate();
        }
        Bulletin bulletin;
        try {
            bulletin = bulletinRepository.saveAndFlush(Bulletin.builder()
                    .serviceDate(serviceDate)
                    .uploadedBy(actor)
                    .build());
        } catch (DataIntegrityViolationException e) {
            // 위 검사와 저장 사이에 다른 요청이 먼저 만든 경우 (DB UNIQUE가 잡는다)
            throw duplicate();
        }

        List<Attachment> saved = new ArrayList<>();
        for (int i = 0; i < pages.size(); i++) {
            MultipartFile file = pages.get(i);
            int pageNo = i + 1;
            String key = keyOf(bulletin.getId(), pageNo, file);

            r2Client.put(key, file);

            // ★ 크기를 여기서 읽는다. §5.1이 pages[].width·height를 요구하고,
            //   FE 타입은 non-null이다 — 뷰어가 이미지를 받기 **전에** 자리를
            //   잡아야 로딩 중 화면이 튀지 않는다.
            //   ⚠️ 사진첩(§6.5)은 FE가 크기를 보내주지만 주보는 그런 필드가
            //      없다. 서버가 파일을 열어 읽는 수밖에 없다.
            Dimension size = dimensionOf(file);

            saved.add(attachmentRepository.save(Attachment.builder()
                    .bulletin(bulletin)
                    .r2Key(key)
                    .filename(filenameOf(file, pageNo))
                    .contentType(file.getContentType())
                    .sizeBytes(file.getSize())
                    .width(size == null ? null : size.width)
                    .height(size == null ? null : size.height)
                    .sortOrder(pageNo)
                    .build()));
        }

        log.info("주보 업로드: id={} date={} pages={}",
                bulletin.getId(), serviceDate, saved.size());
        return new Created(String.valueOf(bulletin.getId()), saved.size());
    }

    // ── 장별 다운로드 (FE 제안 · FR-BUL-04) ──────────────────────────

    /**
     * 한 쪽을 내려받을 URL.
     *
     * <p>⚠️ <b>계약(§5)에 없는 엔드포인트다.</b> FE가 {@code types.ts}에
     * {@code [CONTRACT]}로 제안했고, 경로도 그쪽이 정한 것을 그대로 쓴다.
     * {@code FR-BUL-04}가 장별 다운로드를 요구하는데 §5에 그 경로가 없었다.
     *
     * <p>권한을 {@code M}으로 둔 근거: FE 제안이 {@code M}이었고,
     * 2026-09-04에 주보 열람 자체가 {@code M}이 되면서 앞뒤가 맞았다.
     * (제안 시점에는 열람이 공개라 다운로드만 로그인을 요구하는 모양이었다.)
     *
     * <p>★ {@code §5.1}의 {@code pages[].url}과 <b>다른 값이 필요하다.</b>
     * 그쪽은 열람용이라 브라우저가 탭에서 열어버린다 — 여기서는 R2에
     * {@code Content-Disposition: attachment}를 지시해 저장되게 한다.
     */
    @Transactional(readOnly = true)
    public String pageDownloadUrl(Long bulletinId, int pageNo) {
        Bulletin bulletin = bulletinRepository.findById(bulletinId)
                .orElseThrow(ApiException::notFound);

        Attachment page = attachmentRepository
                .findByBulletinIdOrderBySortOrderAsc(bulletin.getId()).stream()
                .filter(a -> a.getSortOrder() == pageNo)
                .findFirst()
                .orElseThrow(ApiException::notFound);

        return r2Client.presignedDownloadUrl(page.getR2Key(),
                "%s-%d쪽.%s".formatted(
                        bulletin.getServiceDate(), pageNo, extensionOf(page.getFilename())));
    }

    private static String extensionOf(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot < 0 ? "webp" : filename.substring(dot + 1);
    }

    // ── §5.5 삭제 ────────────────────────────────────────────────────

    /**
     * 주보 삭제 — <b>R2 객체까지</b> 지운다.
     *
     * <p>⚠️ 객체를 남기면 용량이 조용히 새고, 10GB를 넘는 순간 과금이 시작된다.
     * DeleteObject는 무료라 아까워할 이유가 없다.
     */
    @Transactional
    public void delete(Long id) {
        Bulletin bulletin = bulletinRepository.findById(id).orElseThrow(ApiException::notFound);
        List<Attachment> pages = attachmentRepository.findByBulletinIdOrderBySortOrderAsc(id);

        r2Client.deleteAll(pages.stream().map(Attachment::getR2Key).toList());

        attachmentRepository.deleteAll(pages);
        bulletinRepository.delete(bulletin);
        log.info("주보 삭제: id={} pages={}", id, pages.size());
    }

    // ── 보조 ─────────────────────────────────────────────────────────

    /** {@code id}와 페이지 수 (§5.4 응답) */
    public record Created(String id, int pageCount) {
    }

    private BulletinResponse detailOf(Bulletin bulletin) {
        List<BulletinPageResponse> pages =
                attachmentRepository.findByBulletinIdOrderBySortOrderAsc(bulletin.getId()).stream()
                        .map(page -> new BulletinPageResponse(
                                page.getSortOrder(),
                                r2Client.presignedGetUrl(page.getR2Key()),
                                page.getWidth(),
                                page.getHeight()))
                        .toList();

        return new BulletinResponse(
                String.valueOf(bulletin.getId()), bulletin.getServiceDate(), pages);
    }

    private Map<Long, List<Attachment>> pagesOf(List<Bulletin> bulletins) {
        if (bulletins.isEmpty()) {
            return Map.of();
        }
        List<Long> ids = bulletins.stream().map(Bulletin::getId).toList();

        Map<Long, List<Attachment>> byBulletin = new HashMap<>();
        for (Attachment attachment : attachmentRepository.findByBulletinIds(ids)) {
            byBulletin.computeIfAbsent(attachment.getBulletin().getId(), key -> new ArrayList<>())
                    .add(attachment);
        }
        return byBulletin;
    }

    private void validate(List<MultipartFile> pages) {
        if (pages == null || pages.isEmpty()) {
            throw ApiException.validation("pages", "페이지 이미지를 1장 이상 올려주세요.");
        }
        if (pages.size() > MAX_PAGES) {
            throw ApiException.validation("pages",
                    "페이지는 최대 %d장까지 올릴 수 있습니다.".formatted(MAX_PAGES));
        }
        for (MultipartFile file : pages) {
            if (file.isEmpty()) {
                throw ApiException.validation("pages", "빈 파일이 있습니다.");
            }
            String contentType = file.getContentType();
            // ⚠️ 이미지가 아니면 막는다. 브라우저가 뷰어에서 그대로 여는 값이라,
            //    html·svg가 들어오면 우리 도메인 밖이라도 스크립트가 도는 문서가 된다.
            if (contentType == null || !contentType.startsWith("image/")
                    || contentType.contains("svg")) {
                throw ApiException.validation("pages", "이미지 파일만 올릴 수 있습니다.");
            }
        }
    }

    private static long totalBytes(List<MultipartFile> pages) {
        return pages.stream().mapToLong(MultipartFile::getSize).sum();
    }

    private static ApiException duplicate() {
        // FE가 "교체하시겠습니까?"를 묻고 다시 요청한다 (§5.4)
        return ApiException.duplicate("serviceDate", "그 주일의 주보가 이미 있습니다.");
    }

    /**
     * R2 키.
     *
     * <p>⚠️ 업로드 파일명을 키에 넣지 않는다. 사용자가 정하는 값이라 경로 탈출
     * ({@code ../})이나 제어문자가 섞일 수 있고, 키는 우리가 만들면 그만이다.
     */
    private static String keyOf(Long bulletinId, int pageNo, MultipartFile file) {
        return "bulletins/%d/%d.%s".formatted(bulletinId, pageNo, extensionOf(file));
    }

    /**
     * 이미지의 픽셀 크기.
     *
     * <p>⚠️ <b>{@code ImageIO}는 WebP를 못 읽는다.</b> FE가 2048px WebP로 변환해
     * 올리므로 이 경로가 기본값이고, 그때는 {@code null}이 된다 — 헤더에서
     * 직접 읽어낸다.
     *
     * <p>읽지 못해도 업로드를 실패시키지 않는다. 크기는 뷰어의 편의값이고,
     * 그것 때문에 주보가 안 올라가는 것이 더 나쁘다.
     */
    private static Dimension dimensionOf(MultipartFile file) {
        try (InputStream in = file.getInputStream()) {
            byte[] head = in.readNBytes(64);
            Dimension webp = WebpHeader.dimensionOf(head);
            if (webp != null) {
                return webp;
            }
        } catch (IOException e) {
            log.warn("이미지 크기를 읽지 못했다: {}", file.getOriginalFilename());
            return null;
        }
        // WebP가 아니면 ImageIO가 읽을 수 있다 (jpeg·png)
        try (InputStream in = file.getInputStream()) {
            BufferedImage image = ImageIO.read(in);
            return image == null ? null : new Dimension(image.getWidth(), image.getHeight());
        } catch (IOException e) {
            log.warn("이미지 크기를 읽지 못했다: {}", file.getOriginalFilename());
            return null;
        }
    }

    private static String extensionOf(MultipartFile file) {
        String contentType = file.getContentType();
        if (contentType == null) {
            return "bin";
        }
        return switch (contentType) {
            case "image/webp" -> "webp";
            case "image/jpeg" -> "jpg";
            case "image/png" -> "png";
            default -> "bin";
        };
    }

    /** 사람이 읽을 이름. 원본 파일명은 신뢰하지 않으므로 우리가 짓는다 */
    private static String filenameOf(MultipartFile file, int pageNo) {
        return "%d.%s".formatted(pageNo, extensionOf(file));
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
}
