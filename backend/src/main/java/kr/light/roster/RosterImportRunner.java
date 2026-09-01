package kr.light.roster;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.Reader;
import java.nio.charset.MalformedInputException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * 명단 CSV 임포트 실행기 (SPEC_API.md §2.1 · BACKEND_TASKS.md §10 M2).
 *
 * <h2>⚠️ 운영에서 절대 돌면 안 된다</h2>
 * 명단은 교인 수백 명의 이름·생년월일·전화번호다. {@code SeedRunner}와 같은
 * 세 겹으로 막는다.
 * <ol>
 *   <li>{@code @Profile("local")} — prod·test에서는 빈이 만들어지지 않는다</li>
 *   <li>{@link #abortIfProduction} — 그럼에도 prod가 함께 켜져 있으면
 *       <b>기동을 중단</b>한다 ({@code local,prod} 같은 실수를 잡는다)</li>
 *   <li>{@code app.roster.import.enabled} 기본 false</li>
 * </ol>
 *
 * <p>그리고 네 번째로, {@code app.roster.import.apply}가 기본 false다 —
 * 켜도 <b>예행연습</b>이 먼저다.
 *
 * <p><b>임포트 실패가 기동을 막지는 않는다.</b> 파일이 없거나 깨졌다고 서버가
 * 안 뜨면 명단과 무관한 개발이 전부 멈춘다. 크게 로그를 남기고 넘어간다.
 */
@Slf4j
@Component
@Profile("local")
@RequiredArgsConstructor
public class RosterImportRunner implements ApplicationRunner {

    private final RosterImporter importer;
    private final RosterImportProperties properties;
    private final Environment environment;

    @Override
    public void run(ApplicationArguments args) {
        abortIfProduction();

        if (!properties.isRunnable()) {
            return;
        }

        Path csv = Path.of(properties.path());
        if (!Files.isReadable(csv)) {
            log.error("명단 CSV를 읽을 수 없습니다: {} — 임포트를 건너뜁니다", csv.toAbsolutePath());
            return;
        }

        try (Reader reader = Files.newBufferedReader(csv, properties.resolvedCharset())) {
            RosterImportReport report = importer.importFrom(
                    reader, properties.apply(), properties.deactivateMissing());

            log.info(report.render());

            if (!properties.apply()) {
                log.warn("예행연습이었습니다 — DB에 반영하려면 app.roster.import.apply=true");
            }
            if (report.hasBlockingProblems()) {
                log.warn("★ 가입을 막는 문제가 있습니다. CSV를 고치고 다시 돌리세요");
            }
        } catch (MalformedInputException e) {
            // 가장 흔한 실수다: 한국어 엑셀이 CP949로 저장한 파일을 UTF-8로 읽는 경우.
            // 다행히 UTF-8 디코더가 잘못된 바이트열을 거부해 여기서 걸린다 —
            // 조용히 깨진 이름이 DB에 들어가는 것보다 훨씬 낫다.
            log.error("명단 CSV를 {} 로 읽지 못했습니다: {} — 인코딩이 맞습니까? "
                            + "한국어 엑셀의 「CSV로 저장」 기본값은 MS949입니다 "
                            + "(app.roster.import.charset)",
                    properties.charset(), csv.getFileName());
        } catch (IOException e) {
            // 경로는 남기되 내용은 남기지 않는다 — 예외 메시지에 행 내용이 실릴 수 있다
            log.error("명단 임포트 실패: {} ({})", csv.getFileName(), e.getClass().getSimpleName());
        }
    }

    /**
     * prod 프로필이 함께 켜져 있으면 기동을 중단한다.
     *
     * <p>{@code @Profile("local")}만으로는 {@code local,prod}를 막지 못한다 —
     * 둘 다 활성이면 이 빈은 만들어진다. 운영 DB에 개발용 명단이 들어가거나,
     * 반대로 운영 명단이 개발자 노트북의 로그로 흘러나오는 경로다.
     */
    private void abortIfProduction() {
        for (String profile : environment.getActiveProfiles()) {
            if ("prod".equalsIgnoreCase(profile)) {
                throw new IllegalStateException(
                        "운영 프로필에서 명단 임포트를 실행하려 했습니다. "
                                + "활성 프로필을 확인하세요 (local과 prod가 함께 켜져 있습니다)");
            }
        }
    }
}
