package kr.light.config;

import io.swagger.v3.core.converter.ModelConverters;
import io.swagger.v3.core.converter.ResolvedSchema;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import com.fasterxml.jackson.databind.JsonNode;
import kr.light.common.ErrorCode;
import kr.light.common.ErrorResponse;
import org.springdoc.core.utils.SpringDocUtils;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

/**
 * Swagger UI = FE와의 계약서 (ARCHITECTURE.md §6.1).
 *
 * <p>컨트롤러를 만들면 문서가 자동으로 갱신되므로 별도 문서를 손으로 관리하지
 * 않는다. 이 클래스가 채우는 것은 <b>자동 생성이 알 수 없는 부분</b>뿐이다 —
 * 제목·서버 주소·인증 방식, 그리고 모든 엔드포인트가 공유하는 에러 봉투.
 *
 * <p>⚠️ <b>Swagger는 사전 합의를 대체하지 못한다.</b> 구현된 뒤에 생기는
 * 문서이므로, 시그니처는 여전히 W0에 합의한 {@code SPEC_API.md}가 기준이다
 * (INTEGRATION.md §3.3).
 *
 * <p>운영에서는 {@code springdoc.api-docs.enabled: false}로 문서 자체를 끈다.
 * 내부 문서를 다루는 사이트라 엔드포인트 목록을 공개하지 않는다.
 */
@Configuration
public class OpenApiConfig {

    static {
        // 리치텍스트 본문처럼 "임의의 JSON"인 필드는 DTO에서 JsonNode로 받는다.
        // 그대로 두면 계약서에 Jackson 내부 타입 이름({@code JsonNode})이 그대로
        // 새어나가고, 정작 스키마 본문은 비어 있어 FE에게 아무 정보가 없다.
        // 필드에 @Schema(type = "object")를 달아도 springdoc은 $ref를 우선한다.
        SpringDocUtils.getConfig().replaceWithSchema(JsonNode.class, new ObjectSchema());
    }

    /**
     * 쿠키 인증 스키마 이름.
     *
     * <p>⚠️ <b>쿠키 이름은 아직 docs에 없다.</b> 인증 구현이 M2라 지금은
     * 자리만 잡아둔 값이다. M2에서 실제 발급 코드를 쓸 때 이 이름으로 확정하거나
     * 바꾼다. FE가 분기에 쓰는 값이 아니고(httpOnly라 JS가 읽지 못한다) 브라우저가
     * 자동으로 실어 보내므로 계약 위험은 낮지만, 확정 전까지 근거로 삼지 말 것.
     */
    private static final String COOKIE_AUTH = "cookieAuth";
    private static final String ACCESS_TOKEN_COOKIE = "access_token";

    @Bean
    public OpenAPI lightOpenApi() {
        return new OpenAPI()
                .info(info())
                .servers(java.util.List.of(
                        new Server().url("http://localhost:8080").description("로컬 개발"),
                        new Server().url("/").description("FE 프록시 경유 (동일 출처)")
                ))
                .components(components());
    }

    private Info info() {
        return new Info()
                .title("LIGHT API")
                .version("v1")
                .description("""
                        김해교회 청년교회 홈페이지 API.

                        **이 문서는 살아있는 계약서입니다.** 합의 기준은 `docs/spec/SPEC_API.md`이고,
                        여기는 실제 구현이 내보내는 형태입니다. 둘이 어긋나면 계약 위반이므로
                        `INTEGRATION.md §5` 절차를 따라 주세요.

                        ### 공통 응답 규약 (SPEC_API.md §1.1)
                        - 성공: `{ "data": ... }`
                        - 실패: `{ "error": { "code": ..., "message": ..., "field": null } }`
                        - 페이징: `{ "data": { "items": [], "page": 0, "hasNext": true } }`
                        - 사진 목록만 커서 페이징: `{ "data": { "items": [], "nextCursor": ... } }`

                        ### 직렬화 규칙 (SPEC_API.md §1.3)
                        - **ID는 문자열**입니다 (`"123"`). JS `Number` 정밀도 이슈 회피.
                          `sizeBytes`·`page`·`photoCount` 같은 나머지 숫자는 숫자 그대로입니다.
                        - 날짜는 ISO-8601. `LocalDate` → `"2026-08-24"`, 시각은 UTC + `Z`
                        - null인 필드도 생략하지 않고 `null`로 내보냅니다

                        ### 인증
                        JWT를 **httpOnly 쿠키**로 발급합니다 (`HttpOnly; Secure; SameSite=Lax`).
                        FE가 Next.js `rewrites`로 동일 출처를 만들기 때문에 CORS 설정은 없습니다.

                        > ⚠️ 인증은 M2에서 구현됩니다. 지금 이 문서에는 공개 엔드포인트만 있습니다.
                        """);
    }

    private Components components() {
        Components components = new Components()
                .addSecuritySchemes(COOKIE_AUTH, new SecurityScheme()
                        .type(SecurityScheme.Type.APIKEY)
                        .in(SecurityScheme.In.COOKIE)
                        .name(ACCESS_TOKEN_COOKIE)
                        .description("""
                                로그인 시 서버가 심는 httpOnly 쿠키입니다. JS가 읽을 수 없고
                                브라우저가 자동으로 실어 보내므로 Swagger UI에서 직접 넣을
                                수는 없습니다. 인증이 필요한 API는 브라우저에서 로그인한 뒤
                                시도해 주세요."""));

        // 에러 봉투를 components에 등록해 둔다. 컨트롤러가 아직 없어도 FE가
        // 실패 응답의 형태를 볼 수 있어야 하기 때문이다.
        // 레코드에서 직접 뽑으므로 ErrorResponse가 바뀌면 문서도 따라 바뀐다.
        registerErrorSchemas(components);
        errorResponses().forEach(components::addResponses);

        return components;
    }

    private void registerErrorSchemas(Components components) {
        ResolvedSchema resolved = ModelConverters.getInstance()
                .resolveAsResolvedSchema(new io.swagger.v3.core.converter.AnnotatedType(ErrorResponse.class));
        if (resolved != null && resolved.referencedSchemas != null) {
            resolved.referencedSchemas.forEach(components::addSchemas);
        }
    }

    /**
     * 에러 코드별 공용 응답 — 컨트롤러에서
     * {@code @ApiResponse(responseCode = "403", ref = "#/components/responses/FORBIDDEN")}
     * 로 참조한다. 엔드포인트마다 같은 설명을 다시 쓰지 않기 위한 것이다.
     */
    private Map<String, ApiResponse> errorResponses() {
        Map<String, ApiResponse> responses = new java.util.LinkedHashMap<>();
        for (ErrorCode code : ErrorCode.values()) {
            responses.put(code.name(), new ApiResponse()
                    .description("%s — %s".formatted(code.name(), code.defaultMessage()))
                    .content(new Content().addMediaType(
                            org.springframework.http.MediaType.APPLICATION_JSON_VALUE,
                            new MediaType()
                                    .schema(new Schema<>().$ref("#/components/schemas/ErrorResponse"))
                                    .example(Map.of("error", exampleBody(code))))));
        }
        return responses;
    }

    private Map<String, Object> exampleBody(ErrorCode code) {
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("code", code.name());
        body.put("message", code.defaultMessage());
        // field는 VALIDATION_ERROR에서만 값이 들어간다 (SPEC_API.md §1.3)
        body.put("field", code == ErrorCode.VALIDATION_ERROR ? "loginId" : null);
        return body;
    }
}
