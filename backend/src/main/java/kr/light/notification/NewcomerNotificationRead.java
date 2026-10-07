package kr.light.notification;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * 이 사람이 새가족 알림을 어디까지 봤는지.
 *
 * <h2>★ 알림 내용을 복사해두지 않는다</h2>
 * "안 읽은 새가족 신청"은 {@code newcomer_requests}에 이미 전부 있다. 알림
 * 테이블을 따로 만들어 같은 내용을 옮겨 적으면 두 곳이 어긋난다 — 신청은
 * 보유기간(§8.6)으로 지워졌는데 알림만 남아 있는 상태가 대표적이다.
 *
 * <p>그래서 저장하는 것은 <b>시각 하나</b>뿐이다. 안 읽은 목록은 그 시각
 * 이후에 들어온 신청이고, 원본이 지워지면 알림도 함께 사라진다.
 *
 * <h2>★ 읽음은 사람별이다</h2>
 * 팀 공유로 두면 한 사람이 열어본 것만으로 모두의 배지가 사라진다. 하지만
 * <b>열어본 것과 연락한 것은 다르다.</b> 새가족 연락은 늦어도 되지만
 * 빠뜨리면 안 되는 종류라, 각자에게 남게 한다.
 *
 * <p>⚠️ <b>행이 없으면 "전부 안 읽음"이다.</b> 새로 임원이 된 사람에게는 지난
 * 신청이 한꺼번에 보인다 — 보유기간이 1년이라 그만큼으로 한정된다. 놓치는
 * 쪽보다 많이 보이는 쪽이 안전해서 이렇게 둔다.
 *
 * <p>⚠️ 갱신은 {@link NewcomerNotificationReadRepository#markSeen}이 한 문장으로
 * 한다. 이 엔티티는 <b>읽기 전용</b>으로만 쓴다.
 */
@Entity
@Table(name = "newcomer_notification_reads")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NewcomerNotificationRead {

    /** 회원 한 명당 한 줄. 계정이 지워지면 표시도 함께 사라진다 (ON DELETE CASCADE) */
    @Id
    @Column(name = "member_id")
    private Long memberId;

    /** 이 시각까지 봤다. <b>이후에</b> 들어온 신청이 안 읽음이다 */
    @Column(name = "last_seen_at", nullable = false)
    private Instant lastSeenAt;

    /** 관측용. 쓰기는 전부 네이티브 upsert가 하므로 JPA로는 건드리지 않는다 */
    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private Instant updatedAt;
}
