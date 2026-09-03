package kr.light.attendance;

import kr.light.common.ApiException;
import kr.light.common.PageResponse;
import kr.light.member.Member;
import kr.light.roster.RosterEntry;
import kr.light.roster.RosterEntryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 출석부 (SPEC_API.md §13).
 *
 * <p>⚠️ <b>출결 대상은 계정이 아니라 명단이다.</b> 계정을 만들지 않은 교인도
 * 체크한다 — 그래서 {@code member_roster}를 기준으로 돈다.
 *
 * <p>⚠️ 출석 기록은 "누가 교회에 안 나왔는지"의 기록이라 <b>예산안과 같은 급의
 * 민감 정보</b>다 (§13.0). 전 경로가 {@code L}(임원) 이상이고, 응답에
 * 전화번호·생년월일을 싣지 않는다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AttendanceService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    /**
     * 마을 정렬에서 <b>맨 뒤로 보낼</b> 값.
     *
     * <p>{@code newcomer}(새가족)는 숫자 마을 뒤에 오는 것이 화면 순서다.
     * ⚠️ 문자열 정렬로도 {@code 'n' > '9'}라 뒤로 가지만, 규칙을 코드로
     * 드러내 두어야 마을 표기가 바뀔 때 여기를 보게 된다.
     */
    private static final String NEWCOMER = "newcomer";

    private final AttendanceSessionRepository sessionRepository;
    private final AttendanceEntryRepository entryRepository;
    private final RosterEntryRepository rosterRepository;

    // ── §13.1 목록 ───────────────────────────────────────────────────

    /** 회차 목록 — 날짜 내림차순 */
    @Transactional(readOnly = true)
    public PageResponse<SessionSummaryResponse> list(int page, int size) {
        Page<AttendanceSession> sessions =
                sessionRepository.findAllByOrderByDateDescIdDesc(PageRequest.of(page, size));

        // active 명단 전체 인원 — 회차마다 같은 값이라 한 번만 센다
        long rosterCount = rosterRepository.countByActiveTrue();

        // ★ 회차마다 상세를 부르지 않기 위해 집계를 한 번에 가져온다
        Map<Long, long[]> counts = countsFor(sessions.getContent());

        return PageResponse.of(sessions, session -> {
            long[] c = counts.getOrDefault(session.getId(), new long[]{0, 0});
            return new SessionSummaryResponse(
                    String.valueOf(session.getId()),
                    session.getDate(), session.getType(), session.getTitle(),
                    c[0], c[1], rosterCount);
        });
    }

    // ── §13.2 생성 ───────────────────────────────────────────────────

    /**
     * 회차 생성.
     *
     * <p>같은 날짜 + 같은 종류가 이미 있으면 {@code DUPLICATE}다 — 회차가 둘
     * 생기면 출결이 갈라져 "누가 체크했는지"를 알 수 없게 된다.
     */
    @Transactional
    public String create(CreateSessionRequest request, Member actor) {
        if (sessionRepository.existsByDateAndType(request.date(), request.type())) {
            throw ApiException.duplicate("date", "같은 날짜에 이미 회차가 있습니다.");
        }
        try {
            AttendanceSession saved = sessionRepository.saveAndFlush(AttendanceSession.create(
                    request.date(), request.type(), request.title(), actor));
            return String.valueOf(saved.getId());
        } catch (DataIntegrityViolationException e) {
            // 위 검사와 저장 사이에 다른 요청이 먼저 만든 경우 (DB UNIQUE가 잡는다).
            // 검사만 두면 동시에 눌렀을 때 둘 다 통과한다.
            throw ApiException.duplicate("date", "같은 날짜에 이미 회차가 있습니다.");
        }
    }

    // ── §13.3 상세 ───────────────────────────────────────────────────

    /**
     * 회차 + <b>명단 전원</b>의 출결.
     *
     * <p>체크된 사람만 주면 화면이 명단을 따로 불러 합쳐야 한다. 체크 화면은
     * 명단을 훑으며 상태를 찍는 방식이라 <b>아직 체크하지 않은 사람도</b>
     * {@code status: null}로 함께 내려간다.
     */
    @Transactional(readOnly = true)
    public SessionDetailResponse get(Long sessionId) {
        AttendanceSession session = find(sessionId);

        Map<Long, AttendanceStatus> recorded = new HashMap<>();
        for (AttendanceEntry entry : entryRepository.findBySessionId(sessionId)) {
            recorded.put(entry.getRosterEntry().getId(), entry.getStatus());
        }

        List<EntryResponse> entries = rosterRepository.findByActiveTrueOrderByNameAsc().stream()
                .sorted(byVillageThenName())
                .map(roster -> new EntryResponse(
                        String.valueOf(roster.getId()),
                        roster.getName(),
                        roster.getVillage(),
                        // 행이 없으면 null — "기록 없음"이다 (ABSENT와 다르다)
                        recorded.get(roster.getId())))
                .toList();

        return new SessionDetailResponse(
                String.valueOf(session.getId()),
                session.getDate(), session.getType(), session.getTitle(), entries);
    }

    // ── §13.4 출결 기록 ──────────────────────────────────────────────

    /**
     * 출결 upsert — <b>전체 교체가 아니다</b>.
     *
     * <p>★ 보낸 항목만 덮고 나머지는 그대로 둔다. <b>두 임원이 동시에 서로 다른
     * 마을을 체크하는 것이 정상 흐름</b>이라, 전체 교체로 구현하면 서로의 기록을
     * 덮어쓴다. FE도 이 전제로 변경분만 보낸다 (§13.4).
     */
    @Transactional
    public void upsertEntries(Long sessionId, List<EntryUpsertRequest> requests, Member actor) {
        AttendanceSession session = find(sessionId);

        Map<Long, AttendanceEntry> existing = new HashMap<>();
        for (AttendanceEntry entry : entryRepository.findBySessionId(sessionId)) {
            existing.put(entry.getRosterEntry().getId(), entry);
        }

        for (EntryUpsertRequest request : requests) {
            RosterEntry roster = rosterRepository.findById(parseRosterId(request.rosterId()))
                    .orElseThrow(() -> ApiException.validation(
                            "rosterId", "명단에 없는 대상입니다."));

            AttendanceEntry entry = existing.get(roster.getId());
            if (entry != null) {
                entry.changeStatus(request.status(), actor);
            } else {
                entryRepository.save(
                        AttendanceEntry.create(session, roster, request.status(), actor));
            }
        }
    }

    // ── §13.5 삭제 ───────────────────────────────────────────────────

    /** 회차 삭제 — 출결 기록까지 함께 사라진다 (DB CASCADE) */
    @Transactional
    public void delete(Long sessionId) {
        sessionRepository.delete(find(sessionId));
        log.info("출석 회차 삭제: session={}", sessionId);
    }

    // ── 보조 ─────────────────────────────────────────────────────────

    private AttendanceSession find(Long sessionId) {
        return sessionRepository.findById(sessionId).orElseThrow(ApiException::notFound);
    }

    private Map<Long, long[]> countsFor(List<AttendanceSession> sessions) {
        if (sessions.isEmpty()) {
            return Map.of();
        }
        List<Long> ids = sessions.stream().map(AttendanceSession::getId).toList();

        Map<Long, long[]> counts = new HashMap<>();
        for (Object[] row : entryRepository.countBySessionIds(ids)) {
            counts.put((Long) row[0], new long[]{
                    ((Number) row[1]).longValue(),                        // checkedCount
                    row[2] == null ? 0L : ((Number) row[2]).longValue()   // presentCount
            });
        }
        return counts;
    }

    /**
     * 마을 → 이름 순 (§13.3).
     *
     * <p>체크 화면이 <b>마을 단위로 도는 것</b>을 전제한다 — 임원이 자기 마을
     * 사람들을 연달아 찍는다.
     *
     * <p>순서: 숫자 마을 → {@code newcomer} → <b>마을 미지정(null)</b>.
     * 마을이 없는 사람도 체크 대상이라 목록에서 빼지 않고 맨 뒤에 둔다 —
     * 빼면 그 사람은 아무도 출결을 찍을 수 없다.
     */
    private Comparator<RosterEntry> byVillageThenName() {
        return Comparator
                .comparingInt((RosterEntry r) -> villageRank(r.getVillage()))
                .thenComparing(r -> r.getVillage() == null ? "" : r.getVillage())
                .thenComparing(RosterEntry::getName);
    }

    private static int villageRank(String village) {
        if (village == null) {
            return 2;               // 마을 미지정 — 맨 뒤
        }
        return NEWCOMER.equals(village) ? 1 : 0;
    }

    /** FE는 id를 문자열로 다룬다 (§1.3). 숫자가 아니면 명단에 없는 값이다 */
    private static Long parseRosterId(String rosterId) {
        try {
            return Long.parseLong(rosterId.trim());
        } catch (NumberFormatException e) {
            throw ApiException.validation("rosterId", "명단에 없는 대상입니다.");
        }
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
