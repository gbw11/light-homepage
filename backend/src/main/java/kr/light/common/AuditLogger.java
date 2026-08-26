package kr.light.common;

import kr.light.member.Member;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 감사 로그 기록.
 *
 * <p>RLS가 없어 애플리케이션이 권한을 전담하므로, 누가 무엇을 바꿨는지
 * 되짚을 수 있어야 한다. 특히 회원 승인·역할 부여는 사고가 나면 반드시
 * 추적 대상이 된다.
 *
 * <p>호출하는 트랜잭션에 참여한다 — 즉 <b>본 작업이 롤백되면 로그도 함께
 * 사라진다.</b> "일어나지 않은 일"이 로그에 남는 것보다 낫다고 판단했다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AuditLogger {

    private final AuditLogRepository repository;

    /**
     * @param actor  행위자. 시스템이 수행한 동작이면 null
     * @param target 대상 식별자 (예: {@code "member:51"})
     * @param detail 사람이 읽을 변경 내용 (예: {@code "MEMBER → LEADER"})
     */
    @Transactional
    public void log(Member actor, AuditAction action, String target, String detail) {
        repository.save(AuditLog.builder()
                .actor(actor)
                .action(action.name())
                .target(target)
                .detail(detail)
                .build());

        log.info("audit action={} actor={} target={}",
                action, actor != null ? actor.getId() : "system", target);
    }
}
