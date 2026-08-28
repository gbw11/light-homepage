package kr.light.seed;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 개발용 시드 계정 설정 — {@code app.seed.*}.
 *
 * <p><b>⚠️ 비밀번호에 기본값을 두지 않는다.</b> 커밋되는 파일에 시드 계정
 * 비밀번호가 들어가면 안 된다 (INTEGRATION.md §2 · ARCHITECTURE.md §13).
 * 값이 없으면 시드를 만들지 않고 안내만 남긴다 — 임의의 기본값으로 계정을
 * 만들어 두는 편이 훨씬 위험하다.
 *
 * @param enabled  시드를 만들지 여부. 기본 false
 * @param password 세 계정이 공유하는 비밀번호. {@code application-local.yml}이나
 *                 {@code SEED_PASSWORD} 환경변수로 준다 (둘 다 커밋되지 않는다)
 */
@ConfigurationProperties(prefix = "app.seed")
public record SeedProperties(boolean enabled, String password) {

    boolean isUsable() {
        return enabled && password != null && !password.isBlank();
    }
}
