package kr.light.roster;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.mock.env.MockEnvironment;

import java.io.IOException;
import java.io.Reader;
import java.io.StringWriter;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 명단 임포트 실행기의 <b>방어</b>.
 *
 * <p>여기서 보는 것은 기능이 아니다. 명단은 교인 수백 명의 이름·생년월일·
 * 전화번호이고, 이 실행기가 잘못 도는 것은 그 파일이 잘못된 곳으로 가는 것과
 * 같다. 임포트 자체는 {@link RosterImporterTest}가 본다.
 */
class RosterImportRunnerTest {

    @TempDir Path tempDir;

    /** 임포터를 실제로 부르지 않고 "불렀는지"만 본다 */
    private final AtomicInteger calls = new AtomicInteger();
    private final AtomicReference<String> readContent = new AtomicReference<>();

    @Test
    @DisplayName("★ prod 프로필이 함께 켜져 있으면 기동을 중단한다")
    void prod에서는_기동을_막는다() throws IOException {
        // @Profile("local")만으로는 local,prod처럼 둘 다 켠 실수를 막지 못한다.
        // 운영 DB에 개발용 명단이 들어가거나, 반대로 운영 명단이 개발자
        // 노트북의 로그로 흘러나오는 경로다.
        var runner = runner(properties(true, csv("이름,생년월일,전화번호\n"), true), "local", "prod");

        assertThatThrownBy(() -> runner.run(new DefaultApplicationArguments()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("prod");

        assertThat(calls).hasValue(0);
    }

    @Test
    @DisplayName("enabled=false면 파일이 있어도 읽지 않는다")
    void 꺼두면_돌지_않는다() throws IOException {
        var runner = runner(properties(false, csv("이름,생년월일,전화번호\n"), true), "local");

        runner.run(new DefaultApplicationArguments());

        assertThat(calls).hasValue(0);
    }

    @Test
    @DisplayName("경로가 비어 있으면 조용히 넘어간다 — 기본 상태다")
    void 경로가_없으면_넘어간다() {
        var runner = runner(properties(true, null, true), "local");

        assertThatCode(() -> runner.run(new DefaultApplicationArguments()))
                .doesNotThrowAnyException();
        assertThat(calls).hasValue(0);
    }

    @Test
    @DisplayName("파일이 없어도 기동을 막지 않는다 — 명단과 무관한 개발까지 멈춘다")
    void 파일이_없어도_기동한다() {
        var runner = runner(
                properties(true, tempDir.resolve("없는파일.csv").toString(), true), "local");

        assertThatCode(() -> runner.run(new DefaultApplicationArguments()))
                .doesNotThrowAnyException();
        assertThat(calls).hasValue(0);
    }

    @Test
    @DisplayName("★ CP949로 저장된 파일도 설정한 인코딩으로 읽는다")
    void 인코딩_설정이_실제로_적용된다() throws IOException {
        // 한국어 Windows 엑셀의 「CSV로 저장」 기본값이 CP949다. 설정만 맞으면
        // 접미사까지 그대로 읽힌다 — 어긋났을 때의 동작은 아래 테스트가 본다.
        Path path = tempDir.resolve("roster-cp949.csv");
        Files.write(path, "이름,생년월일,전화번호\n김도연a,2001-03-14,010-1234-5678\n"
                .getBytes(Charset.forName("MS949")));

        var runner = runner(new RosterImportProperties(
                true, path.toString(), "MS949", false, false), "local");
        runner.run(new DefaultApplicationArguments());

        assertThat(calls).hasValue(1);
        assertThat(readContent.get()).contains("김도연a");
    }

    @ParameterizedTest(name = "{0} 파일을 {1} 로 읽기")
    @CsvSource({"MS949, UTF-8", "UTF-8, MS949"})
    @DisplayName("★ 인코딩이 어긋나면 어느 방향이든 깨진 채 들어가지 않고 실패한다")
    void 인코딩이_어긋나면_한_글자도_읽지_않는다(String fileCharset, String configured)
            throws IOException {

        Path path = tempDir.resolve("roster.csv");
        Files.write(path, "이름,생년월일,전화번호\n김도연a,2001-03-14,010-1234-5678\n"
                .getBytes(Charset.forName(fileCharset)));

        var runner = runner(new RosterImportProperties(
                true, path.toString(), configured, true, false), "local");

        // ★ Files.newBufferedReader의 디코더는 잘못된 바이트열을 REPORT한다
        //   (MalformedInputException). 그래서 깨진 이름이 DB에 들어가는 대신
        //   임포트가 실패하고, 로그가 인코딩을 지목한다.
        //   ⚠️ 이건 UTF-8·CP949처럼 "거부할 줄 아는" 인코딩이라 성립한다.
        //      ISO-8859-1처럼 모든 바이트를 받아들이는 값을 설정하면 조용히
        //      깨지므로, 리포트의 이름 표본이 두 번째 방어로 남아 있다.
        assertThatCode(() -> runner.run(new DefaultApplicationArguments()))
                .doesNotThrowAnyException();     // 기동은 막지 않는다
        assertThat(readContent.get()).isNull();  // 한 글자도 읽히지 않았다
    }

    @Test
    @DisplayName("알 수 없는 인코딩 이름은 UTF-8로 떨어뜨린다 — 기동을 막지 않는다")
    void 잘못된_인코딩_이름() {
        var properties = new RosterImportProperties(true, "x", "CP-없음", false, false);

        assertThat(properties.resolvedCharset()).isEqualTo(StandardCharsets.UTF_8);
    }

    // ── 도우미 ───────────────────────────────────────────────────────

    private String csv(String content) throws IOException {
        Path path = tempDir.resolve("roster.csv");
        Files.writeString(path, content);
        return path.toString();
    }

    private RosterImportProperties properties(boolean enabled, String path, boolean apply) {
        return new RosterImportProperties(enabled, path, "UTF-8", apply, false);
    }

    /** 임포터를 가로채, 실제 DB 없이 "무엇이 어떤 인코딩으로 읽혔는지"만 본다 */
    private RosterImportRunner runner(RosterImportProperties properties, String... profiles) {
        var environment = new MockEnvironment();
        environment.setActiveProfiles(profiles);

        RosterImporter spy = new RosterImporter(new RosterCsvParser(), null) {
            @Override
            public RosterImportReport importFrom(Reader source, boolean apply, boolean deactivateMissing)
                    throws IOException {
                calls.incrementAndGet();

                StringWriter captured = new StringWriter();
                source.transferTo(captured);
                readContent.set(captured.toString());

                return new RosterImportReport(apply, 0, 0, 0, 0, 0, List.of(), List.of());
            }
        };
        return new RosterImportRunner(spy, properties, environment);
    }
}
