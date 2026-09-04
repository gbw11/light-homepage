package kr.light.meeting;

import kr.light.common.ApiException;
import kr.light.member.Member;
import kr.light.storage.R2Client;
import kr.light.storage.StorageUsageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * 월례회 자료 업로드 (SPEC_API.md §7.4~§7.6).
 *
 * <h2>⚠️ 업로드한 PDF 원본은 보관하지 않는다</h2>
 * 페이지 이미지로 바꾼 뒤 <b>버린다.</b> 남기면 그 자체가 유출 경로가 된다 —
 * 워터마크도 없고 열람 기간도 걸리지 않은 원본이 R2에 있는 셈이기 때문이다.
 *
 * <h2>동기 처리다</h2>
 * 10페이지에 15~30초가 걸린다 (§7.4). 비동기로 돌리면 "올렸는데 아직 안
 * 보인다"는 상태를 FE가 따로 다뤄야 하고, 실패했을 때 알릴 방법도 없다.
 * 월례회 자료는 한 달에 한 번 올리는 것이라 그 비용을 감수한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MeetingUploadService {

    private final MeetingDocRepository meetingDocRepository;
    private final MeetingDocPageRepository meetingDocPageRepository;
    private final MeetingQueryService meetingQueryService;
    private final StorageUsageService storageUsageService;
    private final PdfPageRenderer renderer;
    private final R2Client r2Client;

    // ── §7.4 업로드 ──────────────────────────────────────────────────

    @Transactional
    public Created create(String title, LocalDate meetingDate,
                          Instant viewableFrom, Instant viewableUntil,
                          MultipartFile file, Member actor) {

        validate(title, viewableFrom, viewableUntil, file);

        // ⚠️ 변환 **전에** 용량을 본다. 이미지가 원본보다 커질 수 있어
        //    정확한 예측은 어렵지만, 이미 꽉 찬 상태에서 시작하지는 않게 한다.
        storageUsageService.assertCanUpload(file.getSize());

        MeetingDoc doc = meetingDocRepository.saveAndFlush(MeetingDoc.builder()
                .title(title.trim())
                .meetingDate(meetingDate)
                .viewableFrom(viewableFrom)
                .viewableUntil(viewableUntil)
                .pageCount(0)          // 변환이 끝나야 안다
                .createdBy(actor)
                .build());

        List<MeetingDocPage> pages = new ArrayList<>();
        int pageCount;
        try (InputStream pdf = file.getInputStream()) {
            pageCount = renderer.render(pdf, (jpeg, pageNo) -> {
                String key = keyOf(doc.getId(), pageNo);

                // ★ 만들자마자 R2로 넘긴다. 모아뒀다가 한 번에 올리면
                //   512MB에서 10장을 들고 있게 된다.
                r2Client.put(key, new ByteArrayInputStream(jpeg), jpeg.length, "image/jpeg");

                pages.add(meetingDocPageRepository.save(MeetingDocPage.builder()
                        .doc(doc)
                        .pageNo(pageNo)
                        .r2Key(key)
                        .sizeBytes(jpeg.length)
                        .build()));
            });
        } catch (IOException e) {
            throw ApiException.validation("file", "파일을 읽을 수 없습니다.");
        }

        doc.setPageCount(pageCount);

        log.info("월례회 자료 업로드: id={} pages={} 원본={}바이트 (원본은 보관하지 않는다)",
                doc.getId(), pageCount, file.getSize());
        return new Created(String.valueOf(doc.getId()), pageCount);
    }

    // ── §7.5 기간 수정 ───────────────────────────────────────────────

    /** 연장·조기 종료. 자료를 다시 올리지 않고 창만 바꾼다 */
    @Transactional
    public void changeWindow(Long id, Instant from, Instant until) {
        assertWindow(from, until);
        meetingQueryService.find(id).changeWindow(from, until);
        log.info("월례회 열람 기간 변경: id={} {} ~ {}", id, from, until);
    }

    // ── §7.6 삭제 ────────────────────────────────────────────────────

    /** 페이지 이미지까지 지운다 (§7.6) */
    @Transactional
    public void delete(Long id) {
        MeetingDoc doc = meetingQueryService.find(id);
        List<MeetingDocPage> pages = meetingDocPageRepository.findByDocIdOrderByPageNoAsc(id);

        r2Client.deleteAll(pages.stream().map(MeetingDocPage::getR2Key).toList());

        meetingDocPageRepository.deleteAll(pages);
        meetingDocRepository.delete(doc);
        log.info("월례회 자료 삭제: id={} pages={}", id, pages.size());
    }

    // ── 보조 ─────────────────────────────────────────────────────────

    /** §7.4 응답 */
    public record Created(String id, int pageCount) {
    }

    private void validate(String title, Instant from, Instant until, MultipartFile file) {
        if (title == null || title.isBlank()) {
            throw ApiException.validation("title", "제목을 입력해 주세요.");
        }
        assertWindow(from, until);

        if (file == null || file.isEmpty()) {
            throw ApiException.validation("file", "PDF 파일을 선택해 주세요.");
        }
        // ⚠️ content-type만 믿지 않는다 — 브라우저가 틀리게 붙이기도 하고
        //    사용자가 조작할 수도 있다. 실제 판정은 PdfPageRenderer가 파일을
        //    열어보며 한다. 여기서는 명백히 아닌 것만 일찍 걸러낸다.
        String contentType = file.getContentType();
        if (contentType != null && !contentType.equals("application/pdf")
                && !contentType.equals("application/octet-stream")) {
            throw ApiException.validation("file", "PDF 파일만 올릴 수 있습니다.");
        }
    }

    private static void assertWindow(Instant from, Instant until) {
        if (from == null || until == null) {
            throw ApiException.validation("viewableFrom", "열람 기간을 입력해 주세요.");
        }
        if (!until.isAfter(from)) {
            // DB에도 CHECK가 있지만, 여기서 막아야 사용자가 이유를 안다
            throw ApiException.validation("viewableUntil",
                    "종료 시각이 시작 시각보다 뒤여야 합니다.");
        }
    }

    /**
     * R2 키.
     *
     * <p>⚠️ 이 값은 <b>응답에 절대 나가지 않는다</b> (§7.3). 월례회는
     * presigned URL도 발급하지 않는다 — 발급하면 기간이 끝난 뒤에도 URL이
     * 만료 전까지 살아 있고 공유된다.
     */
    private static String keyOf(Long docId, int pageNo) {
        return "meetings/%d/%d.jpg".formatted(docId, pageNo);
    }
}
