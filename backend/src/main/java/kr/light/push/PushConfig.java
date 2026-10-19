package kr.light.push;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * 푸시 발송기 고르기 (SPEC_API.md §15).
 *
 * <ul>
 *   <li>{@code app.push.firebase-service-account}(= {@code FIREBASE_SERVICE_ACCOUNT})가
 *       있으면 {@link FcmPushSender}</li>
 *   <li>없으면 {@link NoopPushSender} — 알림만 건너뛰고 앱은 정상 동작</li>
 * </ul>
 */
@Slf4j
@Configuration
public class PushConfig {

    @Bean
    PushSender pushSender(@Value("${app.push.firebase-service-account:}") String serviceAccountJson) {
        if (serviceAccountJson == null || serviceAccountJson.isBlank()) {
            log.info("FIREBASE_SERVICE_ACCOUNT 없음 — 푸시를 보내지 않는다");
            return new NoopPushSender();
        }
        return new FcmPushSender(serviceAccountJson);
    }

    /**
     * 발송 스레드. 커밋 뒤에 여기로 넘겨, FCM이 느려도 글 등록 응답이 늦지 않게 한다.
     *
     * <p>{@code app.push.async=false}(테스트)면 같은 스레드에서 바로 보낸다 —
     * 응답 직후에 "무엇을 보냈나"를 확인할 수 있게.
     *
     * <p>알림은 드물다(주 몇 건). 스레드 하나 · 대기열 100이면 충분하고, 넘치면
     * 그 알림만 버린다 — 등록 자체를 막지 않는다.
     */
    @Bean
    Executor pushExecutor(@Value("${app.push.async:true}") boolean async) {
        if (!async) {
            return Runnable::run;
        }
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setThreadNamePrefix("push-");
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(100);
        executor.setRejectedExecutionHandler((task, pool) -> log.warn("푸시 대기열이 가득 차 한 건을 버렸다"));
        executor.initialize();
        return executor;
    }
}
