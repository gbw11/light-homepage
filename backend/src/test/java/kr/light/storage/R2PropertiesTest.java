package kr.light.storage;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * R2 접속 설정 (ARCHITECTURE.md §4.4).
 *
 * <p>스프링 없이 도는 순수 테스트다 — 이 계산에 컨텍스트가 필요 없다.
 */
class R2PropertiesTest {

    private static final String ACCOUNT = "0123456789abcdef0123456789abcdef";

    @Test
    @DisplayName("엔드포인트는 계정 ID에서 조립한다 — 따로 설정하게 두면 오타가 난다")
    void 엔드포인트() {
        var properties = new R2Properties(ACCOUNT, "light-media", "key", "secret");

        assertThat(properties.endpoint())
                .isEqualTo("https://" + ACCOUNT + ".r2.cloudflarestorage.com");
    }

    @Test
    @DisplayName("★ 관할(jurisdiction) 주소가 아니다 — eu/us가 끼면 붙어도 버킷을 못 찾는다")
    void 관할_주소가_아니다() {
        var properties = new R2Properties(ACCOUNT, "light-media", "key", "secret");

        assertThat(properties.endpoint())
                .doesNotContain(".eu.").doesNotContain(".us.").doesNotContain(".fedramp.");
    }

    @Test
    @DisplayName("계정 ID가 없으면 엔드포인트를 만들지 않는다 — 엉뚱한 주소로 붙는 것보다 낫다")
    void 계정_없음() {
        var properties = new R2Properties(null, "light-media", "key", "secret");

        assertThatThrownBy(properties::endpoint)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("account-id");
    }

    @ParameterizedTest(name = "account={0} bucket={1} key={2} secret={3} → {4}")
    @CsvSource({
            "acc, bucket, key, secret, true",
            // ★ 하나라도 비면 부르지 않는다. 절반만 설정된 상태로 R2를 부르면
            //   인증 실패가 나는데, 원인이 설정 누락이라는 게 드러나지 않는다.
            "'',  bucket, key, secret, false",
            "acc, '',     key, secret, false",
            "acc, bucket, '',  secret, false",
            "acc, bucket, key, '',     false",
            "'  ', bucket, key, secret, false",
    })
    void 설정_완비_판정(String account, String bucket, String key, String secret, boolean expected) {
        assertThat(new R2Properties(account, bucket, key, secret).isConfigured())
                .isEqualTo(expected);
    }

    @Test
    @DisplayName("개발 중 전부 비어 있는 것은 정상이다 — 기동을 막지 않는다")
    void 전부_비어_있어도_된다() {
        // 키가 없다고 기동을 막으면 R2와 무관한 기능도 손댈 수 없다.
        assertThat(new R2Properties(null, null, null, null).isConfigured()).isFalse();
    }
}
