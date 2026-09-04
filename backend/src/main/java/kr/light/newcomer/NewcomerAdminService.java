package kr.light.newcomer;

import kr.light.common.PageResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * 새가족 신청 조회와 보유기간 관리 (SPEC_API.md §8.6).
 *
 * <h2>왜 이제야 만드는가</h2>
 * 신청 받는 쪽({@code POST /api/newcomers})은 M1에 만들어 두었고 그동안 신청이
 * 쌓이고 있었다. 그런데 <b>보는 방법이 없었다</b> — DB를 직접 열지 않으면
 * 전도사가 새가족이 왔다는 것을 알 수 없었다. 이 클래스가 그 구멍을 닫는다.
 *
 * <h2>⚠️ 지우는 것도 기능이다</h2>
 * §8.6이 <b>보유기간 1년</b>을 정하고 있다. 이름·전화번호가 들어 있는
 * 개인정보이고, 신청 폼에서 동의를 받을 때 그 기간을 고지했다. 지우지 않으면
 * 코드가 약속을 어기는 것이다 — 기능이 아니라 <b>지켜야 할 것</b>이다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NewcomerAdminService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    /** §8.6 — 보유기간 1년 */
    private static final Duration RETENTION = Duration.ofDays(365);

    private final NewcomerRepository newcomerRepository;

    // ── §8.6 목록 ────────────────────────────────────────────────────

    /** 최근 신청이 위 — 전도사가 새로 온 사람부터 연락한다 */
    @Transactional(readOnly = true)
    public PageResponse<NewcomerRecordResponse> list(int page, int size) {
        return PageResponse.of(
                newcomerRepository.findAllByOrderByCreatedAtDescIdDesc(PageRequest.of(page, size)),
                NewcomerRecordResponse::of);
    }

    // ── 보유기간 정리 ────────────────────────────────────────────────

    /**
     * 1년 지난 신청을 지운다 (§8.6).
     *
     * <p>하루에 한 번 돈다. 보유기간이 1년 단위라 더 자주 돌 이유가 없고,
     * Render 무료 인스턴스는 유휴 시 잠들었다 깨어나므로 정확한 시각을
     * 기대하지 않는다.
     *
     * <p>⚠️ <b>지운 건수만 남기고 누구를 지웠는지는 남기지 않는다.</b> 개인정보를
     * 지우면서 그 사람의 이름을 로그에 옮겨 적으면, 지운 의미가 로그에서
     * 사라진다 ({@link NewcomerNotifier}가 같은 이유로 id만 다룬다).
     */
    @Scheduled(fixedDelayString = "${app.newcomer.retention-cleanup-interval:P1D}")
    @Transactional
    public void purgeExpired() {
        Instant cutoff = Instant.now().minus(RETENTION);
        List<NewcomerRequest> expired = newcomerRepository.findByCreatedAtBefore(cutoff);

        if (expired.isEmpty()) {
            return;
        }
        newcomerRepository.deleteAll(expired);
        log.info("새가족 신청 보유기간 만료 삭제: {}건 (기준 {})", expired.size(), cutoff);
    }

    // ── 보조 ─────────────────────────────────────────────────────────

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
