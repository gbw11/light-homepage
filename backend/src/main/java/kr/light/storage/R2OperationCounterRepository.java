package kr.light.storage;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface R2OperationCounterRepository extends JpaRepository<R2OperationCounter, String> {

    /**
     * 이번 달 행을 만들거나 증가시킨다 — <b>한 문장으로</b>.
     *
     * <p>⚠️ 읽고-더하고-쓰면 동시 업로드에서 증가분이 사라진다(lost update).
     * 세는 것이 목적인 표에서 그러면 있으나 마나다. {@code ON CONFLICT}로
     * DB가 원자적으로 처리하게 둔다.
     *
     * <p>네이티브 쿼리인 이유는 JPQL에 upsert가 없기 때문이다.
     */
    @Modifying
    @Query(value = """
            INSERT INTO r2_operation_counters (year_month, class_a, class_b, updated_at)
            VALUES (:yearMonth, :deltaA, :deltaB, now())
            ON CONFLICT (year_month) DO UPDATE
            SET class_a    = r2_operation_counters.class_a + :deltaA,
                class_b    = r2_operation_counters.class_b + :deltaB,
                updated_at = now()
            """, nativeQuery = true)
    void increment(@Param("yearMonth") String yearMonth,
                   @Param("deltaA") long deltaA,
                   @Param("deltaB") long deltaB);

    @Lock(LockModeType.NONE)
    Optional<R2OperationCounter> findByYearMonth(String yearMonth);
}
