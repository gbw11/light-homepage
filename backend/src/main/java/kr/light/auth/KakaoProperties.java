package kr.light.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * 카카오 로그인 설정 — {@code app.kakao.*} (SPEC_API.md §2.7).
 *
 * <p><b>⚠️ 값은 {@code application-local.yml}에만 둔다.</b> 그 파일은
 * {@code .gitignore}에 걸려 있다. 운영에서는 Render 환경변수로 준다.
 *
 * @param restApiKey   콘솔의 <b>REST API 키</b>. JavaScript 키·Admin 키가 아니다 —
 *                     셋이 나란히 있어 헷갈리기 쉽고, Admin 키는 앱 전체를
 *                     조작할 수 있어 절대 여기 넣으면 안 된다
 * @param clientSecret 콘솔 &gt; 카카오 로그인 &gt; 보안에서 켰다면 그 값.
 *                     켜지 않았으면 비워 둔다
 * @param redirectUri  콘솔에 등록한 값과 <b>글자 그대로</b> 같아야 한다.
 *                     한 글자만 달라도 카카오가 {@code KOE006}으로 되돌린다
 */
@ConfigurationProperties(prefix = "app.kakao")
public record KakaoProperties(
        String restApiKey,
        String clientSecret,
        @DefaultValue("http://localhost:8080/api/auth/kakao/callback") String redirectUri
) {

    /** 키가 없으면 카카오 로그인을 아예 열지 않는다 (개발 중 흔한 상태) */
    public boolean isConfigured() {
        return restApiKey != null && !restApiKey.isBlank();
    }

    public boolean hasClientSecret() {
        return clientSecret != null && !clientSecret.isBlank();
    }
}
