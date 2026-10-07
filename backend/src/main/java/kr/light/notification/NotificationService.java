package kr.light.notification;

import kr.light.newcomer.NewcomerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * 전도사·임원에게 뜨는 알림 (SPEC_API.md §14).
 *
 * <h2>왜 메일이 아닌가</h2>
 * §9.1이 원래 정한 것은 "성공 시 담당자에게 알림 메일"이었다. 그런데 메일은
 * 발신 도메인·SPF·수신자 명단이 정해져야 보낼 수 있고, 그 결정이 나지 않아
 * {@code LoggingNewcomerNotifier}가 id만 로그로 남기는 상태로 몇 달이 지났다 —
 * 즉 <b>실제로는 아무에게도 알려지지 않았다.</b> 새가족 신청을 보려면 누군가
 * §8.6 목록을 열어봐야 했고, 열어볼 이유가 없으면 열지 않는다.
 *
 * <p>웹 알림은 그 결정을 기다리지 않는다. 이미 로그인해 있는 사람에게
 * 띄우는 것이라 도메인도 명단도 필요 없다 (2026-09-09 결정).
 *
 * <h2>★ 알림을 저장하지 않는다</h2>
 * 안 읽은 새가족 신청은 {@code newcomer_requests}에 이미 다 있다. 저장하는
 * 것은 <b>사람마다 "어디까지 봤는지" 시각 하나</b>뿐이고, 알림 목록은 그
 * 시각으로 매번 계산한다 ({@link NewcomerNotificationRead} 참고).
 *
 * <p>그래서 <b>보유기간 1년(§8.6)이 알림에도 그대로 적용된다.</b> 원본이
 * 지워지면 알림도 사라진다 — 따로 지울 것이 없다.
 *
 * <h2>⚠️ 폴링이다</h2>
 * 실시간으로 밀어주지 않는다. FE가 주기적으로 {@link #unread}를 부른다.
 * 새가족 연락은 초 단위로 급한 일이 아니고, Web Push는 서비스 워커·구독
 * 저장·VAPID 키가 필요해 이 기능 하나로 들이기에는 무겁다.
 */
@Service
@RequiredArgsConstructor
public class NotificationService {

    /**
     * 한 번에 내려주는 최대 건수.
     *
     * <p>안 읽은 것이 300건 쌓여 있어도 화면에 300줄을 뿌릴 이유가 없다.
     * ⚠️ 자르는 것은 목록뿐이고 <b>개수는 실제 수를 센다</b> — 목록 길이로
     * 배지를 만들면 "20"에서 멈춘다.
     */
    static final int MAX_ITEMS = 20;

    /**
     * 표시가 없는 사람의 기준 시각.
     *
     * <p>⚠️ 회원 가입 시각이 아니라 <b>태초</b>다. 즉 새로 임원이 된 사람에게는
     * 남아 있는 신청이 전부 안 읽음으로 보인다. 보유기간이 1년이라 그만큼으로
     * 한정되고, <b>놓치는 쪽보다 많이 보이는 쪽이 안전</b>해서 이렇게 둔다.
     */
    private static final Instant NEVER_READ = Instant.EPOCH;

    private final NewcomerRepository newcomerRepository;
    private final NewcomerNotificationReadRepository readRepository;

    // ── 조회 ─────────────────────────────────────────────────────────

    /** 이 사람이 아직 안 본 알림 */
    @Transactional(readOnly = true)
    public NotificationListResponse unread(long memberId) {
        Instant since = lastSeenAt(memberId);

        List<NotificationItemResponse> items = newcomerRepository
                .findByCreatedAtAfterOrderByCreatedAtDescIdDesc(since, Pageable.ofSize(MAX_ITEMS))
                .stream()
                .map(NotificationItemResponse::ofNewcomer)
                .toList();

        return NotificationListResponse.of(newcomerRepository.countByCreatedAtAfter(since), items);
    }

    // ── 읽음 처리 ────────────────────────────────────────────────────

    /**
     * 읽음으로 표시한다.
     *
     * <p>{@code until}은 <b>목록 응답의 {@code readMarker}를 그대로 되돌려받는
     * 것</b>이 정석이다. 그러면 목록을 본 뒤 새로 들어온 알림은 안 읽음으로
     * 남는다.
     *
     * <p>⚠️ {@code until}이 {@code null}이면 서버 시각까지 전부 읽음이다.
     * 편하지만 <b>목록과 이 요청 사이에 들어온 신청이 조용히 사라진다.</b>
     * 그래도 두는 이유는, FE가 목록을 거치지 않고 "모두 읽음"만 누르는 화면을
     * 만들 수 있어서다.
     *
     * <p>미래 시각은 서버 시각으로 자른다 — 클라이언트 시계가 앞서 있으면
     * 아직 오지 않은 알림까지 읽음이 되어버린다.
     */
    @Transactional
    public NotificationReadResponse markRead(long memberId, Instant until, Instant now) {
        Instant requested = (until == null || until.isAfter(now)) ? now : until;

        readRepository.markSeen(memberId, requested);

        // ⚠️ requested가 아니라 실제로 표시된 값으로 센다. markSeen이 greatest로
        //    뒤로 되돌리지 않으므로, 과거를 보냈으면 기존 표시가 그대로 남는다
        Instant effective = lastSeenAt(memberId);
        return new NotificationReadResponse(
                effective, newcomerRepository.countByCreatedAtAfter(effective));
    }

    // ── 보조 ─────────────────────────────────────────────────────────

    private Instant lastSeenAt(long memberId) {
        return readRepository.findById(memberId)
                .map(NewcomerNotificationRead::getLastSeenAt)
                .orElse(NEVER_READ);
    }
}
