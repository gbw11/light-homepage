package kr.light.meeting;

import kr.light.common.ApiException;
import kr.light.common.PhoneNumbers;
import kr.light.member.Member;
import kr.light.storage.R2Client;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/**
 * 월례회 페이지 스트리밍 (SPEC_API.md §7.3) — <b>이 기능의 핵심</b>.
 *
 * <h2>처리 순서 (§7.3)</h2>
 * <ol>
 *   <li>인증·역할 확인 (회원 이상 — 컨트롤러의 {@code @PreAuthorize})</li>
 *   <li>{@code L}↑이 아니면 열람 기간 검사 → 기간 외 <b>403</b></li>
 *   <li>R2에서 원본 페이지 읽기</li>
 *   <li>워터마크 합성</li>
 *   <li>스트리밍 응답</li>
 *   <li>{@code meeting_doc_views} 기록</li>
 * </ol>
 *
 * <h2>⚠️ presigned URL을 발급하지 않는다</h2>
 * 발급하면 <b>열람 기간이 끝난 뒤에도 URL이 만료 전까지 살아 있고 공유
 * 가능해진다</b> (§7 머리말). 그래서 서버가 직접 읽어 워터마크를 태운 뒤
 * 바이트로 내보낸다 — 이 프로젝트에서 파일이 서버를 통과하는 유일한 읽기
 * 경로다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MeetingPageService {

    /**
     * 같은 사람·같은 페이지의 열람 기록을 다시 남기지 않는 간격.
     *
     * <p>뷰어에서 페이지를 앞뒤로 넘기면 같은 요청이 반복된다. 그때마다 행을
     * 남기면 기록이 금세 수만 건이 되고, 정작 §7.7 화면에서 <b>"누가 봤는지"를
     * 읽기 어려워진다</b> — 기록의 목적이 흐려진다.
     */
    private static final Duration VIEW_DEDUPE = Duration.ofMinutes(10);

    private static final DateTimeFormatter STAMP =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(ZoneId.of("Asia/Seoul"));

    private final MeetingQueryService meetingQueryService;
    private final MeetingDocPageRepository pageRepository;
    private final MeetingDocViewRepository viewRepository;
    private final WatermarkPainter watermarkPainter;
    private final R2Client r2Client;

    /**
     * 워터마크가 태워진 페이지 이미지.
     *
     * @param viewer 열람자 — 워터마크에 이름과 연락처 뒷자리가 박힌다
     */
    @Transactional(readOnly = true)
    public byte[] render(Long docId, int pageNo, Member viewer) {
        MeetingDoc doc = meetingQueryService.assertViewable(docId, viewer.getRole());

        MeetingDocPage page = pageRepository.findByDocIdAndPageNo(docId, pageNo)
                .orElseThrow(ApiException::notFound);

        byte[] original = r2Client.read(page.getR2Key());

        byte[] watermarked;
        try {
            watermarked = watermarkPainter.paint(
                    new ByteArrayInputStream(original), labelFor(doc, viewer));
        } catch (IOException e) {
            log.error("워터마크 합성 실패: doc={} page={}", docId, pageNo, e);
            // ⚠️ 원본을 그대로 내보내지 않는다. 워터마크 없는 페이지가 나가면
            //    추적 수단이 사라지는데, 사용자는 정상적으로 받았다고 생각한다.
            throw new IllegalStateException("페이지를 만들지 못했습니다.", e);
        }
        return watermarked;
    }

    /**
     * 열람 기록 (§7.3 6번 · §7.7).
     *
     * <p>⚠️ {@code REQUIRES_NEW}다. 기록이 실패했다고 페이지 응답을 되돌리면
     * 사용자는 자료를 못 본다. 반대로 <b>기록 없이 페이지가 나가는 것</b>은
     * 추적 근거가 비는 것이라 로그로 남긴다.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordView(Long docId, int pageNo, Member viewer, String ip, String userAgent) {
        Instant since = Instant.now().minus(VIEW_DEDUPE);
        if (viewRepository.existsByDocIdAndMemberIdAndPageNoAndViewedAtAfter(
                docId, viewer.getId(), pageNo, since)) {
            return;
        }
        viewRepository.save(MeetingDocView.builder()
                .doc(meetingQueryService.find(docId))
                .member(viewer)
                .pageNo(pageNo)
                .ip(ip)
                .userAgent(trim(userAgent))
                .build());
    }

    // ── 보조 ─────────────────────────────────────────────────────────

    /**
     * 워터마크 문구 (§7.3).
     *
     * <p>{@code 김도연 5678 · 2026-08-24 14:03 · #3}
     *
     * <p>세 조각이 각각 하는 일이 다르다 — <b>이름</b>은 누구인지,
     * <b>열람시각</b>은 언제 받은 사본인지, <b>문서ID</b>는 어느 자료인지.
     * 하나라도 빠지면 대조가 안 된다.
     *
     * <p>연락처는 <b>뒷 4자리만</b> 쓴다. 전체를 태우면 캡처 한 장으로
     * 연락처가 유출된다 — 막으려는 것을 스스로 하는 셈이다.
     */
    private static String labelFor(MeetingDoc doc, Member viewer) {
        String tail = phoneTail(viewer.getPhone());
        String who = tail == null ? viewer.getName() : viewer.getName() + " " + tail;
        return "%s · %s · #%d".formatted(who, STAMP.format(Instant.now()), doc.getId());
    }

    /** {@code 010-1234-5678} → {@code 5678}. 번호가 없으면 null */
    private static String phoneTail(String phone) {
        if (phone == null || phone.isBlank()) {
            return null;
        }
        String digits = PhoneNumbers.normalize(phone);
        return digits.length() < 4 ? null : digits.substring(digits.length() - 4);
    }

    /** {@code user_agent}가 varchar(300)이다 — 긴 UA가 오면 저장이 실패한다 */
    private static String trim(String userAgent) {
        if (userAgent == null) {
            return null;
        }
        return userAgent.length() <= 300 ? userAgent : userAgent.substring(0, 300);
    }
}
