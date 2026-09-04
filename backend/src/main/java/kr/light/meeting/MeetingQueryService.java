package kr.light.meeting;

import kr.light.common.ApiException;
import kr.light.common.PageResponse;
import kr.light.member.Role;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

/**
 * 월례회 자료 조회와 <b>열람 기간 판정</b> (SPEC_API.md §7.1 · §7.2).
 *
 * <h2>⚠️ 이 클래스의 존재 이유는 목록이 아니라 관문이다</h2>
 * "지금 이 사람이 이 자료를 열 수 있는가"를 <b>한 곳에서만</b> 판단한다.
 * 같은 판단이 목록·상세·페이지 스트리밍 세 곳에 흩어지면 언젠가 어긋나고,
 * 그러면 <b>기간이 끝난 자료가 열린다.</b>
 *
 * <h2>규칙</h2>
 * <ul>
 *   <li>열람은 회원(M)부터다 — 비로그인은 이 서비스에 도달하지 못한다</li>
 *   <li>{@code MEMBER}는 <b>열람 기간 안에만</b></li>
 *   <li>{@code LEADER} 이상은 <b>기간과 무관하게</b> — 자료를 만들고 관리하는 쪽이라
 *       기간이 끝난 뒤에도 확인해야 한다 (§7.1)</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class MeetingQueryService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private final MeetingDocRepository meetingDocRepository;

    // ── §7.1 목록 ────────────────────────────────────────────────────

    /** 최근 월례회가 위. <b>종료된 자료도 남는다</b> — 존재는 알리되 내용은 막는다 */
    @Transactional(readOnly = true)
    public PageResponse<MeetingSummaryResponse> list(int page, int size) {
        Instant now = Instant.now();

        return PageResponse.of(
                meetingDocRepository.findAllByOrderByMeetingDateDescIdDesc(PageRequest.of(page, size)),
                doc -> new MeetingSummaryResponse(
                        String.valueOf(doc.getId()),
                        doc.getTitle(),
                        doc.getMeetingDate(),
                        doc.getPageCount(),
                        doc.getViewableFrom(),
                        doc.getViewableUntil(),
                        doc.statusAt(now)));
    }

    // ── §7.2 상세 ────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public MeetingDetailResponse get(Long id, Role role) {
        MeetingDoc doc = find(id);
        Instant now = Instant.now();

        MeetingDocStatus status = doc.statusAt(now);
        boolean canView = canView(doc, role, now);

        return new MeetingDetailResponse(
                String.valueOf(doc.getId()),
                doc.getTitle(),
                doc.getMeetingDate(),
                doc.getPageCount(),
                status,
                doc.getViewableUntil(),
                remainingSeconds(doc, now),
                canView,
                canView ? null : reasonOf(status));
    }

    // ── 관문 ─────────────────────────────────────────────────────────

    /**
     * 페이지를 열 수 있는가.
     *
     * <p>⚠️ {@code LEADER} 이상은 기간을 건너뛴다. 자료를 올리고 관리하는 쪽이라
     * 기간이 끝난 뒤에도 확인할 수 있어야 한다 (§7.1).
     */
    public boolean canView(MeetingDoc doc, Role role, Instant now) {
        if (role == Role.LEADER || role == Role.PASTOR) {
            return true;
        }
        return doc.isOpenAt(now);
    }

    /**
     * 페이지 스트리밍 직전의 관문 (§7.3 2번).
     *
     * <p>기간 밖이면 <b>403</b>이다 — 404가 아니다. 자료가 있다는 사실은 목록에
     * 이미 나와 있고(§7.1 "존재는 알리되 내용은 차단"), FE가 "열람 기간이
     * 끝났습니다"를 안내해야 하기 때문이다.
     */
    public MeetingDoc assertViewable(Long id, Role role) {
        MeetingDoc doc = find(id);
        if (!canView(doc, role, Instant.now())) {
            throw ApiException.forbidden();
        }
        return doc;
    }

    public MeetingDoc find(Long id) {
        return meetingDocRepository.findById(id).orElseThrow(ApiException::notFound);
    }

    // ── 보조 ─────────────────────────────────────────────────────────

    /** 종료까지 남은 초. 이미 끝났거나 아직 시작 전이면 0 */
    private static long remainingSeconds(MeetingDoc doc, Instant now) {
        if (now.isAfter(doc.getViewableUntil())) {
            return 0;
        }
        if (now.isBefore(doc.getViewableFrom())) {
            return 0;
        }
        return Duration.between(now, doc.getViewableUntil()).toSeconds();
    }

    private static String reasonOf(MeetingDocStatus status) {
        return switch (status) {
            case CLOSED -> "PERIOD_CLOSED";
            case SCHEDULED -> "PERIOD_NOT_STARTED";
            case OPEN -> null;   // 도달하지 않는다 — OPEN인데 못 보는 경우가 없다
        };
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
