package kr.light.auth;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;

/**
 * 카카오 REST API 호출 (SPEC_API.md §2.7 · §2.8).
 *
 * <p><b>타임아웃을 반드시 건다.</b> 카카오가 응답하지 않으면 요청 스레드가
 * 그대로 묶이는데, 우리 톰캣 스레드는 20개뿐이다({@code application.yml}) —
 * 카카오 장애 하나가 사이트 전체를 멈추게 할 수 있다.
 */
@Slf4j
@Component
public class RestClientKakaoClient implements KakaoClient {

    private static final String TOKEN_URL = "https://kauth.kakao.com/oauth/token";
    private static final String USER_URL = "https://kapi.kakao.com/v2/user/me";

    /** 사람이 로그인 화면에서 기다리는 시간이다. 길게 잡을 이유가 없다 */
    private static final Duration TIMEOUT = Duration.ofSeconds(5);

    private final KakaoProperties properties;
    private final RestClient restClient;

    public RestClientKakaoClient(KakaoProperties properties) {
        this.properties = properties;

        var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(TIMEOUT);
        factory.setReadTimeout(TIMEOUT);

        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    @Override
    public String exchangeCodeForAccessToken(String code) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("client_id", properties.restApiKey());
        form.add("redirect_uri", properties.redirectUri());
        form.add("code", code);
        if (properties.hasClientSecret()) {
            form.add("client_secret", properties.clientSecret());
        }

        JsonNode body = post(TOKEN_URL, form);
        String accessToken = text(body, "access_token");
        if (accessToken == null) {
            // ⚠️ 카카오의 오류 본문을 그대로 로그에 남기지 않는다 — 요청을
            //    되풀이해 보려면 code가 필요한데, 그 값이 함께 실릴 수 있다.
            throw new KakaoException("액세스 토큰을 받지 못했습니다: " + errorCodeOf(body));
        }
        return accessToken;
    }

    @Override
    public String fetchUserId(String accessToken) {
        JsonNode body;
        try {
            body = restClient.get()
                    .uri(USER_URL)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (request, response) -> { })
                    .body(JsonNode.class);
        } catch (RestClientException e) {
            throw new KakaoException("카카오에 연결하지 못했습니다", e);
        }

        String id = text(body, "id");
        if (id == null) {
            throw new KakaoException("카카오 사용자 식별자가 없습니다: " + errorCodeOf(body));
        }
        return id;
    }

    /**
     * ★ 4xx에서 예외를 던지지 않게 하고 <b>본문을 읽는다.</b>
     *
     * <p>기본 동작({@code retrieve()})은 4xx면 바로 예외를 던지는데, 그러면
     * 카카오가 알려준 원인({@code KOE320} 같은 코드)이 통째로 사라진다.
     * 실패했다는 것만 알고 <b>왜인지는 알 수 없는 상태</b>가 되어, 설정이
     * 틀렸는지 코드가 만료됐는지 구분할 방법이 없어진다. (실제로 그렇게
     * 만들어 놨다가 실서버 확인에서 막혔다.)
     */
    private JsonNode post(String url, MultiValueMap<String, String> form) {
        try {
            return restClient.post()
                    .uri(url)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (request, response) -> { })
                    .body(JsonNode.class);
        } catch (RestClientException e) {
            // 네트워크·타임아웃 등 응답 자체가 없는 경우
            throw new KakaoException("카카오에 연결하지 못했습니다", e);
        }
    }

    /** {@code id}는 숫자로 오므로 {@code asText()}로 받는다 */
    private static String text(JsonNode body, String field) {
        if (body == null) {
            return null;
        }
        JsonNode value = body.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    /**
     * 카카오가 준 오류 코드만 남긴다.
     *
     * <p>⚠️ {@code error_description}은 남기지 않는다 — 거기에 인가 코드가
     * 그대로 실려 오는 경우가 있고, 그 값은 로그에 남으면 안 된다.
     * 진단에 필요한 것은 {@code error}와 {@code error_code}다.
     *
     * <p>흔한 값: {@code KOE320} 코드 만료·재사용 · {@code KOE006} Redirect URI
     * 미등록 · {@code KOE101} 앱 키 오류 · {@code invalid_client} 시크릿 불일치.
     */
    private static String errorCodeOf(JsonNode body) {
        if (body == null) {
            return "응답 본문 없음";
        }
        String error = text(body, "error");
        String code = text(body, "error_code");
        if (error == null && code == null) {
            return "알 수 없음";
        }
        return code == null ? error : "%s (%s)".formatted(code, error);
    }
}
