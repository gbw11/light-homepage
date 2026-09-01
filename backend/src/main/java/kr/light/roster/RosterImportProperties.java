package kr.light.roster;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

/**
 * 명단 임포트 설정 — {@code app.roster.import.*}.
 *
 * <p><b>⚠️ 명단 CSV 파일은 저장소에 커밋하지 않는다.</b> 교인 수백 명의 이름·
 * 생년월일·전화번호가 담긴 파일이다. 경로는 설정으로 주고, 파일은 저장소 밖에
 * 둔다 (`application-local.yml`은 gitignore됨).
 *
 * @param enabled           기동 시 임포트를 돌릴지. 기본 false
 * @param path              CSV 경로. 저장소 밖을 가리켜야 한다
 * @param charset           ⚠️ 한국어 엑셀의 CSV 기본값은 <b>CP949</b>(MS949)다.
 *                          어긋나면 디코더가 거부해 임포트가 실패하므로 깨진 채
 *                          들어가지는 않는다. 로그가 인코딩을 지목한다
 * @param apply             true여야 DB에 쓴다. 기본 false — 먼저 리포트를 보고
 *                          확인한 뒤 반영하는 것이 기본 순서다
 * @param deactivateMissing CSV에 없는 기존 행을 비활성 처리할지. 기본 false —
 *                          명단 일부만 담긴 CSV를 실수로 넣으면 나머지 전원이
 *                          출석부에서 사라진다
 */
@ConfigurationProperties(prefix = "app.roster.import")
public record RosterImportProperties(
        @DefaultValue("false") boolean enabled,
        String path,
        @DefaultValue("UTF-8") String charset,
        @DefaultValue("false") boolean apply,
        @DefaultValue("false") boolean deactivateMissing
) {

    boolean isRunnable() {
        return enabled && path != null && !path.isBlank();
    }

    Charset resolvedCharset() {
        try {
            return Charset.forName(charset);
        } catch (RuntimeException e) {
            return StandardCharsets.UTF_8;
        }
    }
}
