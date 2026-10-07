package kr.light.newcomer;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface NewcomerRepository extends JpaRepository<NewcomerRequest, Long> {

    /** 신청 목록 — 최근 신청이 위 (SPEC_API.md §8.6) */
    Page<NewcomerRequest> findAllByOrderByCreatedAtDescIdDesc(Pageable pageable);

    /**
     * 보유기간이 지난 신청 (§8.6 — <b>1년 후 삭제</b>).
     *
     * <p>⚠️ 이름·전화번호가 들어 있는 개인정보다. 지우는 것이 기능이 아니라
     * <b>약속</b>이다 — 폼에서 동의를 받을 때 보유기간을 고지했다.
     */
    List<NewcomerRequest> findByCreatedAtBefore(Instant cutoff);

    /**
     * 안 읽은 알림 목록 (§14) — <b>이 시각 이후</b>에 들어온 신청.
     *
     * <p>알림을 따로 저장하지 않기 때문에 알림 목록이 곧 이 조회다
     * ({@code kr.light.notification.NewcomerNotificationRead} 참고).
     *
     * <p>⚠️ {@code After}는 <b>초과</b>다. 표시한 시각과 정확히 같은 신청은
     * 읽은 것으로 본다 — 그래야 목록의 맨 위를 표시로 되돌려받았을 때
     * 그 한 건이 다시 올라오지 않는다.
     */
    List<NewcomerRequest> findByCreatedAtAfterOrderByCreatedAtDescIdDesc(
            Instant since, Pageable pageable);

    /**
     * 안 읽은 알림 수 (§14).
     *
     * <p>⚠️ 목록을 세지 않고 따로 센다. 목록은 20건에서 잘리므로 길이로
     * 배지를 만들면 21건부터 계속 "20"이다.
     */
    long countByCreatedAtAfter(Instant since);
}
