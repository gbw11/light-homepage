package kr.light.notification;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;

public interface NewcomerNotificationReadRepository
        extends JpaRepository<NewcomerNotificationRead, Long> {

    /**
     * 읽은 시각을 올린다 — 행이 없으면 만든다.
     *
     * <p>읽고-없으면-만들고-있으면-고치기를 코드로 나눠 쓰면, 같은 사람이 두
     * 탭에서 동시에 누를 때 한쪽이 유니크 제약에 걸려 500이 된다. 알림을
     * 읽었다고 눌러서 에러가 나는 것은 곤란하므로 DB가 한 번에 처리하게 둔다.
     *
     * <p><b>★ {@code greatest} — 표시를 뒤로 되돌리지 않는다.</b> 화면 두 개가
     * 각각 다른 시점의 목록을 들고 있으면 오래된 쪽이 나중에 도착할 수 있다.
     * 그대로 쓰면 이미 읽은 알림이 되살아나 배지가 오르락내리락한다.
     *
     * <p>JPQL에는 upsert가 없어 네이티브다. {@code clearAutomatically}는 이
     * 문장 뒤에 같은 트랜잭션에서 행을 다시 읽기 때문에 필요하다 — 없으면
     * 1차 캐시의 옛 값이 나온다.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            INSERT INTO newcomer_notification_reads (member_id, last_seen_at, updated_at)
            VALUES (:memberId, :lastSeenAt, now())
            ON CONFLICT (member_id) DO UPDATE
            SET last_seen_at = greatest(newcomer_notification_reads.last_seen_at, :lastSeenAt),
                updated_at   = now()
            """, nativeQuery = true)
    void markSeen(@Param("memberId") Long memberId, @Param("lastSeenAt") Instant lastSeenAt);
}
