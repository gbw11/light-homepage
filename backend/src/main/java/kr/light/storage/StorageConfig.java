package kr.light.storage;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

@Configuration
@EnableConfigurationProperties({StorageProperties.class, R2Properties.class})
class StorageConfig {

    /**
     * "지금이 몇 월인가"를 빈으로 뽑는다.
     *
     * <p>연산 카운터가 월별로 쌓이는데, {@code YearMonth.now()}를 직접 부르면
     * <b>달이 바뀌는 순간의 동작을 테스트할 방법이 없다.</b> 9월 누계가 10월로
     * 안 넘어가고 계속 더해지는 버그는 한 달을 기다려야 발견된다.
     */
    @Bean
    Clock clock() {
        return Clock.systemDefaultZone();
    }
}
