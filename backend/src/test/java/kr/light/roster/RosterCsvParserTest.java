package kr.light.roster;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.IOException;
import java.io.StringReader;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 명단 CSV 파싱.
 *
 * <p>이 파일 형식은 우리가 정하지 않았다 — 교회에서 받은 엑셀이다. 그래서
 * 테스트의 대부분은 "우리가 만든 규칙대로 동작하는가"가 아니라
 * <b>"남이 만든 파일의 별난 점을 견디는가"</b>다.
 */
class RosterCsvParserTest {

    private final RosterCsvParser parser = new RosterCsvParser();

    private RosterCsvParser.Result parse(String csv) throws IOException {
        return parser.parse(new StringReader(csv));
    }

    @Nested
    @DisplayName("헤더")
    class Headers {

        @Test
        @DisplayName("BOM이 붙어 있어도 첫 열을 찾는다 — 엑셀이 늘 붙인다")
        void BOM을_걷어낸다() throws IOException {
            String csv = "﻿이름,생년월일,전화번호\n김도연,2001-03-14,010-1234-5678\n";

            RosterCsvParser.Result result = parse(csv);

            assertThat(result.problems()).isEmpty();
            assertThat(result.rows()).hasSize(1);
        }

        @ParameterizedTest(name = "[{index}] {0}")
        @ValueSource(strings = {"이름,생년월일,전화번호", "성명,생일,연락처", "name,birth_date,phone",
                "이 름, 생년월일 ,휴대폰"})
        @DisplayName("열 이름이 달라도 알아본다 — 명단 양식은 매번 다르다")
        void 열_이름_별칭(String header) throws IOException {
            RosterCsvParser.Result result = parse(header + "\n김도연,2001-03-14,010-1234-5678\n");

            assertThat(result.problems()).isEmpty();
            assertThat(result.rows()).hasSize(1);
        }

        @Test
        @DisplayName("필수 열이 없으면 읽은 헤더를 그대로 보여준다 — 뭘 고쳐야 할지 알려면 필요하다")
        void 필수_열_누락() throws IOException {
            RosterCsvParser.Result result = parse("이름,주소\n김도연,김해시\n");

            assertThat(result.rows()).isEmpty();
            assertThat(result.problems()).singleElement().satisfies(p -> {
                assertThat(p.kind()).isEqualTo(RosterProblem.Kind.MISSING_HEADER);
                assertThat(p.detail()).contains("이름", "주소");
            });
        }

        @Test
        void 빈_파일() throws IOException {
            assertThat(parse("").problems())
                    .singleElement()
                    .extracting(RosterProblem::kind)
                    .isEqualTo(RosterProblem.Kind.MISSING_HEADER);
        }
    }

    @Nested
    @DisplayName("생년월일 — 엑셀이 내보내는 표기가 제각각이다")
    class BirthDate {

        @ParameterizedTest(name = "[{index}] {0}")
        @ValueSource(strings = {"2001-03-14", "2001.03.14", "2001. 3. 14", "2001/3/14", "20010314"})
        void 받아들이는_표기(String raw) {
            assertThat(parser.parseBirthDate(raw)).isEqualTo(LocalDate.of(2001, 3, 14));
        }

        @Test
        @DisplayName("두 자리 연도는 거부한다 — 1901년인지 2001년인지 알 수 없다")
        void 두_자리_연도는_추측하지_않는다() {
            // 여기서 잘못 찍으면 그 사람은 명단에 있는데도 영영 가입하지 못하고,
            // §2.1은 이유를 알려주지 않으므로 본인은 원인을 알 수 없다.
            assertThat(parser.parseBirthDate("01-03-14")).isNull();
        }

        @ParameterizedTest(name = "[{index}] \"{0}\"")
        @ValueSource(strings = {"2001-13-14", "2001-02-30", "미상", "2001", ""})
        void 읽지_못하는_값(String raw) {
            assertThat(parser.parseBirthDate(raw)).isNull();
        }

        @Test
        @DisplayName("읽지 못한 행은 원문을 리포트에 남긴다")
        void 리포트에_원문이_남는다() throws IOException {
            RosterCsvParser.Result result =
                    parse("이름,생년월일,전화번호\n김도연,미상,010-1234-5678\n");

            assertThat(result.rows()).isEmpty();
            assertThat(result.problems()).singleElement().satisfies(p -> {
                assertThat(p.kind()).isEqualTo(RosterProblem.Kind.BAD_BIRTH_DATE);
                assertThat(p.line()).isEqualTo(2);
                assertThat(p.detail()).contains("미상");
            });
        }
    }

    @Nested
    @DisplayName("한 줄 분해")
    class Splitting {

        @Test
        @DisplayName("따옴표 안의 쉼표는 열을 가르지 않는다")
        void 따옴표_안_쉼표() {
            List<String> cells = RosterCsvParser.splitCsv("김도연,\"김해시 내동, 101동\",010-1234-5678");

            // 단순 split(",")이면 여기서 열이 하나 밀리고, 뒤의 모든 열이
            // 조용히 어긋난다 — 예외가 나지 않아 알아채지 못한다
            assertThat(cells).containsExactly("김도연", "김해시 내동, 101동", "010-1234-5678");
        }

        @Test
        void 이스케이프된_따옴표() {
            assertThat(RosterCsvParser.splitCsv("\"그는 \"\"형\"\"이다\",b"))
                    .containsExactly("그는 \"형\"이다", "b");
        }

        @Test
        @DisplayName("주소 열에 쉼표가 있어도 뒤의 전화번호를 제대로 읽는다")
        void 뒷열이_밀리지_않는다() throws IOException {
            String csv = """
                    이름,주소,생년월일,전화번호
                    김도연,"김해시 내동, 101동",2001-03-14,010-1234-5678
                    """;

            RosterCsvParser.Result result = parse(csv);

            assertThat(result.problems()).isEmpty();
            assertThat(result.rows()).singleElement()
                    .extracting(RosterCsvRow::phoneNormalized)
                    .isEqualTo("01012345678");
        }
    }

    @Nested
    @DisplayName("한 줄이 깨져도 나머지를 계속 읽는다")
    class Resilience {

        @Test
        void 문제_행은_건너뛰고_전부_모은다() throws IOException {
            String csv = """
                    이름,생년월일,전화번호,마을
                    김도연a,2001-03-14,010-1234-5678,1
                    ,2002-01-01,010-2222-3333,2
                    이서준,미상,010-3333-4444,2
                    박지호,2003-05-06,1234,3
                    최유진,2004-07-08,010-5555-6666,
                    """;

            RosterCsvParser.Result result = parse(csv);

            assertThat(result.rows())
                    .extracting(RosterCsvRow::name)
                    .containsExactly("김도연a", "최유진");
            assertThat(result.problems())
                    .extracting(RosterProblem::kind)
                    .containsExactly(
                            RosterProblem.Kind.MISSING_FIELD,
                            RosterProblem.Kind.BAD_BIRTH_DATE,
                            RosterProblem.Kind.BAD_PHONE);
        }

        @Test
        @DisplayName("전화번호 문제는 가림 표기로만 남긴다")
        void 전화번호_원문을_로그에_남기지_않는다() throws IOException {
            RosterCsvParser.Result result =
                    parse("이름,생년월일,전화번호\n김도연,2001-03-14,010-12\n");

            assertThat(result.problems()).singleElement()
                    .extracting(RosterProblem::detail).asString()
                    .doesNotContain("010-12");
        }

        @Test
        void 빈_줄은_건너뛴다() throws IOException {
            String csv = "이름,생년월일,전화번호\n\n김도연,2001-03-14,010-1234-5678\n\n";

            RosterCsvParser.Result result = parse(csv);

            assertThat(result.rows()).hasSize(1);
            assertThat(result.problems()).isEmpty();
        }
    }

    @Nested
    @DisplayName("접미사 — 이름의 일부다")
    class Suffix {

        @Test
        void 떼지_않고_그대로_읽는다() throws IOException {
            RosterCsvParser.Result result =
                    parse("이름,생년월일,전화번호\n김도연a,2001-03-14,010-1234-5678\n");

            assertThat(result.rows()).singleElement()
                    .extracting(RosterCsvRow::name)
                    .isEqualTo("김도연a");
        }

        @Test
        void 접미사_판별() {
            assertThat(RosterCsvParser.hasSuffix("김도연a")).isTrue();
            assertThat(RosterCsvParser.hasSuffix("김도연")).isFalse();
            assertThat(RosterCsvParser.baseName("김도연a")).isEqualTo("김도연");
            assertThat(RosterCsvParser.baseName("김도연")).isEqualTo("김도연");
        }
    }

    @Test
    @DisplayName("마을 열은 없어도 된다 — 인증에 쓰이지 않는다")
    void 마을_열_선택() throws IOException {
        RosterCsvParser.Result result =
                parse("이름,생년월일,전화번호\n김도연,2001-03-14,010-1234-5678\n");

        assertThat(result.rows()).singleElement()
                .extracting(RosterCsvRow::village)
                .isNull();
    }
}
