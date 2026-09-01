package kr.light.common;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 전화번호 정규화 (SPEC_API.md §2.1).
 *
 * <p>여기가 틀리면 <b>본인인데도 "명단에서 확인되지 않습니다"</b>가 뜬다.
 * 그리고 §2.1은 어느 필드가 틀렸는지 알려주지 않기로 했으므로 사용자는
 * 원인을 알 수 없다 — 그래서 표기 차이를 흡수하는 것이 기능 자체다.
 */
class PhoneNumbersTest {

    @Nested
    @DisplayName("같은 번호의 서로 다른 표기는 전부 같은 값이 된다")
    class Normalize {

        @ParameterizedTest(name = "[{index}] {0}")
        @ValueSource(strings = {
                "010-1234-5678",
                "01012345678",
                "010 1234 5678",
                "010.1234.5678",
                "(010) 1234-5678",
                "  010-1234-5678  ",
        })
        void 국내_표기(String raw) {
            assertThat(PhoneNumbers.normalize(raw)).isEqualTo("01012345678");
        }

        @ParameterizedTest(name = "[{index}] {0}")
        @ValueSource(strings = {
                "+82-10-1234-5678",
                "+82 10 1234 5678",
                "821012345678",
        })
        @DisplayName("국가번호 표기는 앞의 0을 되살려 국내 표기와 만난다")
        void 국제_표기(String raw) {
            // 82만 떼면 "1012345678"이 되어 "01012345678"과 영영 만나지 않는다
            assertThat(PhoneNumbers.normalize(raw)).isEqualTo("01012345678");
        }

        @Test
        @DisplayName("옛 서울 지역번호(9자리)도 살린다")
        void 지역번호() {
            assertThat(PhoneNumbers.normalize("02-123-4567")).isEqualTo("021234567");
        }
    }

    @Nested
    @DisplayName("말이 안 되는 값은 null — 대조에 쓰지 않는다")
    class Rejected {

        @ParameterizedTest(name = "[{index}] \"{0}\"")
        @ValueSource(strings = {"1234", "010-1234", "없음", "-", "0000000000000000000000"})
        void 자릿수가_맞지_않으면_null(String raw) {
            assertThat(PhoneNumbers.normalize(raw)).isNull();
        }

        @ParameterizedTest
        @NullAndEmptySource
        void 빈_값도_null(String raw) {
            assertThat(PhoneNumbers.normalize(raw)).isNull();
        }
    }

    @Nested
    @DisplayName("가림 표기 — 리포트는 로그로 남고 스크린샷으로 이슈에 붙는다")
    class Mask {

        @ParameterizedTest(name = "{0} -> {1}")
        @CsvSource({
                "01012345678, 010****5678",
                "010-1234-5678, 010****5678",
                "021234567, 021****4567",
        })
        void 앞_3자리와_뒤_4자리만_남긴다(String raw, String expected) {
            assertThat(PhoneNumbers.mask(raw)).isEqualTo(expected);
        }

        @Test
        @DisplayName("가운데를 복원할 수 없다 — 원문이 그대로 새지 않는다")
        void 원문이_남지_않는다() {
            assertThat(PhoneNumbers.mask("01012345678")).doesNotContain("1234");
        }

        @ParameterizedTest
        @ValueSource(strings = {"", "123", "없음"})
        void 짧으면_통째로_가린다(String raw) {
            assertThat(PhoneNumbers.mask(raw)).isEqualTo("***");
        }
    }
}
