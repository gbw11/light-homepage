package kr.light.sermon;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * YouTube 설정 바인딩.
 *
 * <p>⚠️ {@code LightApplication}에 달지 않는다 — 슬라이스 테스트가
 * {@code @SpringBootConfiguration}의 애너테이션을 그대로 읽어, JSON 직렬화만
 * 보는 테스트까지 이 설정을 요구하게 된다 ({@code AuthConfig}·{@code SeedConfig}·
 * {@code RosterConfig}와 같은 이유).
 */
@Configuration
@EnableConfigurationProperties(YoutubeProperties.class)
public class SermonConfig {
}
