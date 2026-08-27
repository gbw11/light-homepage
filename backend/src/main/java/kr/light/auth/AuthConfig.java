package kr.light.auth;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * 인증 관련 설정 바인딩.
 *
 * <p><b>⚠️ 이것을 {@code LightApplication}에 달면 안 된다.</b> {@code @JsonTest}·
 * {@code @WebMvcTest} 같은 슬라이스 테스트는 {@code @SpringBootConfiguration}
 * 클래스에 붙은 애너테이션을 그대로 읽는다. 거기 달아두면 JSON 직렬화만 보는
 * 테스트까지 {@code app.jwt.secret}을 요구하다 컨텍스트 로딩에 실패한다
 * (실제로 {@code JsonContractTest} 4건이 그렇게 깨졌다).
 *
 * <p>슬라이스는 컴포넌트 스캔을 하지 않으므로, 이렇게 별도 {@code @Configuration}에
 * 두면 전체 컨텍스트에서만 로딩된다.
 */
@Configuration
@EnableConfigurationProperties(JwtProperties.class)
public class AuthConfig {
}
