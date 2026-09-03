package kr.light.storage;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.YearMonth;

/**
 * R2 연산 횟수를 기록한다 (COST_GUARDRAILS.md §3.6).
 *
 * <h2>⚠️ 아직 아무도 부르지 않는다</h2>
 * R2 클라이언트가 M3에서 붙는다. <b>부르는 자리는 정해져 있다</b> —
 * 업로드 확정(§6.6 {@code uploads:commit})에서 {@link R2OperationClass#A},
 * 사진·주보 조회와 월례회 페이지 읽기(§7.3)에서 {@link R2OperationClass#B}.
 * 지금 만들어 두는 이유는, R2를 붙이는 커밋에서 이걸 <b>같이</b> 짜면
 * 십중팔구 빠뜨리기 때문이다.
 *
 * <p>★ <b>presigned URL을 발급하는 자리에서 부르지 말 것.</b> 발급은 과금되지
 * 않는다 — 서명은 우리 서버의 암호 연산이고 R2를 호출하지 않는다. 발급 시점에
 * 세면 실제로 쓰이지 않은 URL까지 세어 숫자가 부풀고, "폭주 감지"가 늑대소년이
 * 된다. <b>실제 요청이 일어난 뒤</b>에 센다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class R2OperationRecorder {

    /** 이 비율을 넘으면 경고한다. 한도가 아니라 <b>이상 징후</b>의 기준이다 */
    private static final int WARN_PERCENT = 50;

    private final R2OperationCounterRepository repository;
    private final Clock clock;

    /**
     * 연산 {@code count}건을 기록한다.
     *
     * <p>⚠️ {@code REQUIRES_NEW}다. 호출한 작업이 나중에 실패해 롤백되더라도
     * <b>연산은 이미 R2에서 일어났고 과금도 이미 됐다.</b> 같은 트랜잭션에
     * 태우면 실패한 요청의 비용만 장부에서 사라진다 — 그런데 폭주는 대개
     * 실패가 반복되는 모양이라, 하필 가장 보고 싶은 숫자가 지워진다.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(R2OperationClass operationClass, long count) {
        if (count <= 0) {
            return;
        }
        String yearMonth = YearMonth.now(clock).toString();
        long deltaA = operationClass == R2OperationClass.A ? count : 0;
        long deltaB = operationClass == R2OperationClass.B ? count : 0;

        repository.increment(yearMonth, deltaA, deltaB);
        warnIfUnusual(yearMonth, operationClass);
    }

    /**
     * 한 건.
     *
     * <p>⚠️ <b>이 오버로드에도 {@code @Transactional}이 필요하다.</b> 아래
     * {@link #record(R2OperationClass, long)}를 {@code this}로 부르면 스프링
     * 프록시를 지나가지 않아 그쪽 애노테이션이 적용되지 않는다. 빠뜨리면
     * {@code TransactionRequiredException}으로 <b>기록이 통째로 실패</b>하는데,
     * 세는 것이 목적인 코드라 실패해도 아무 화면도 깨지지 않아 조용히 0으로
     * 남는다 — 폭주를 감지하려고 만든 장치가 폭주 때 침묵한다.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(R2OperationClass operationClass) {
        record(operationClass, 1);
    }

    /** 이번 달 누계 — 진단·테스트용 */
    @Transactional(readOnly = true)
    public long countThisMonth(R2OperationClass operationClass) {
        return repository.findByYearMonth(YearMonth.now(clock).toString())
                .map(counter -> counter.countOf(operationClass))
                .orElse(0L);
    }

    /**
     * 무료 한도의 절반을 넘으면 경고한다.
     *
     * <p>한도(100%)에서 경고하면 늦다. 이 프로젝트의 정상 사용량은 한도의
     * 몇십 분의 일이라, <b>50%에 닿았다는 것 자체가 이미 비정상</b>이다 —
     * 막을 값이 아니라 사람이 들여다볼 신호다.
     */
    private void warnIfUnusual(String yearMonth, R2OperationClass operationClass) {
        repository.findByYearMonth(yearMonth).ifPresent(counter -> {
            long count = counter.countOf(operationClass);
            long free = operationClass.freePerMonth();
            if (count * 100 / free >= WARN_PERCENT) {
                log.warn("⚠️ R2 Class {} 연산이 {}월에 {}회 — 무료 한도 {}회의 {}%다. "
                                + "정상 사용량은 한도의 몇십 분의 일이라 폭주 버그를 의심할 것",
                        operationClass, yearMonth, count, free, count * 100 / free);
            }
        });
    }
}
