package kr.light.storage;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * R2 월별 연산 횟수 (COST_GUARDRAILS.md §3.6).
 *
 * <p><b>★ 과금을 막는 장치가 아니라 버그를 조기에 발견하는 장치다.</b>
 * 조사해보면 우리 동작 중 Class A는 업로드뿐이고, 사람이 사진을 올리는
 * 행위라 월 100만 회는 사실상 도달하지 않는다. 위험한 것은 사용량이 아니라
 * <b>회원 수와 무관하게 늘어나는 사고</b>(재시도 루프 등)이고, 그것을
 * 청구서가 아니라 우리 로그에서 먼저 보려는 것이다.
 *
 * <p>⚠️ 증가는 {@link R2OperationCounterRepository#increment}가 한 문장으로
 * 한다. 이 엔티티는 <b>읽기 전용</b>으로만 쓴다 — 읽고-더하고-쓰면 동시
 * 업로드에서 증가분이 사라진다.
 */
@Entity
@Table(name = "r2_operation_counters")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class R2OperationCounter {

    /** {@code "2026-09"}. 무료 한도가 달 단위로 초기화된다 */
    @Id
    @Column(name = "year_month", length = 7)
    private String yearMonth;

    @Column(name = "class_a", nullable = false)
    private long classA;

    @Column(name = "class_b", nullable = false)
    private long classB;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public long countOf(R2OperationClass operationClass) {
        return operationClass == R2OperationClass.A ? classA : classB;
    }
}
