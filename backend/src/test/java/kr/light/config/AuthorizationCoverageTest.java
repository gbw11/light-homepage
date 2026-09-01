package kr.light.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * <b>인가 매트릭스에 빠진 엔드포인트가 없는지</b> 확인한다.
 *
 * <p>{@code BACKEND_TASKS.md §6}은 이렇게 정하고 있다 —
 * <b>"표에 없는 보호 엔드포인트는 미완성으로 봅니다."</b> 그런데 그 규칙을
 * 지키는 것은 지금까지 사람의 기억이었다. 엔드포인트를 추가하면서 매트릭스에
 * 행을 넣지 않아도 <b>아무 일도 일어나지 않았다</b> — 그리고 인가 테스트가
 * 없는 엔드포인트는 있는 줄도 모르는 채 열려 있을 수 있다.
 *
 * <p>이 테스트가 그 규칙을 기계가 지키게 만든다. 새 엔드포인트를 만들면
 * 아래 목록에 추가해야 하고, 추가하려면 <b>그 엔드포인트의 인가를 한 번은
 * 생각하게 된다.</b> 그게 이 테스트의 진짜 목적이다.
 *
 * <p>⚠️ 클래스 이름에 {@code Authorization}이 들어가야 한다 — Jenkinsfile이
 * {@code --tests "*Authorization*"}으로 인가 테스트를 따로 먼저 돌린다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthorizationCoverageTest {

    /**
     * ⚠️ 이름으로 집는다. actuator가 자기 매핑을 하나 더 등록해서 타입만으로는
     * 빈이 둘이 된다 — 우리 컨트롤러를 들고 있는 것은 이쪽이다.
     */
    @Autowired
    @Qualifier("requestMappingHandlerMapping")
    RequestMappingHandlerMapping handlerMapping;
    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    /**
     * 인가가 확인된 엔드포인트.
     *
     * <p>각 행 옆에 <b>어느 테스트가 덮는지</b>를 적는다. 여기 이름을 적을 수
     * 없다면 그 엔드포인트는 아직 인가가 확인되지 않은 것이다.
     */
    private static final Set<String> COVERED = Set.of(
            // 인증 — 열린 경로 (AuthAuthorizationTest)
            "POST /api/auth/verify-roster",
            "POST /api/auth/register",
            "POST /api/auth/login",
            "POST /api/auth/refresh",
            "POST /api/auth/logout",
            "POST /api/auth/password/reset-with-code",
            // 인증 — 로그인 필요 (AuthAuthorizationTest)
            "GET /api/auth/me",

            // 게시물 읽기 (PostAuthorizationTest 서비스 · PostReadAuthorizationTest HTTP)
            "GET /api/posts",
            "GET /api/posts/{idOrSlug}",
            // 게시물 쓰기 (PostWriteAuthorizationTest)
            "POST /api/posts",
            "PUT /api/posts/{id}",
            "DELETE /api/posts/{id}",

            // 관리 (MemberAdminAuthorizationTest)
            "GET /api/admin/members",
            "PATCH /api/admin/members/{id}/role",
            "POST /api/admin/members/{id}/password/reset",

            "DELETE /api/admin/members/{id}",

            // 공개 (NewcomerAuthorizationTest)
            "POST /api/newcomers"
    );

    /**
     * 인가 대상이 아닌 경로.
     *
     * <p>⚠️ <b>여기에 무언가를 넣는 것은 "이건 아무나 불러도 된다"는 선언이다.</b>
     * 늘리기 전에 정말 그런지 확인할 것.
     */
    private static final List<String> NOT_APPLICABLE = List.of(
            "/actuator",        // 헬스체크. health만 노출돼 있다 (HealthProbeTest)
            "/v3/api-docs",     // 계약서 (OpenApiDocsTest) — 운영에서는 꺼진다
            "/swagger-ui",      // 같은 위 (OpenApiDocsTest)
            "/error",           // 스프링 기본 에러 경로
            "/probe",           // 테스트 전용 컨트롤러 (MethodSecurityAuthorizationTest)
            "/t/"               // 테스트 전용 컨트롤러 (GlobalExceptionHandlerTest)
    );

    @Test
    @DisplayName("★ 인가 매트릭스에 없는 엔드포인트가 있으면 여기서 걸린다")
    void 모든_엔드포인트가_매트릭스에_있다() {
        Set<String> uncovered = new TreeSet<>();

        handlerMapping.getHandlerMethods().forEach((info, method) -> {
            for (String endpoint : endpointsOf(info)) {
                if (!isNotApplicable(endpoint) && !COVERED.contains(endpoint)) {
                    uncovered.add(endpoint);
                }
            }
        });

        assertThat(uncovered)
                .as("""
                        인가가 확인되지 않은 엔드포인트입니다.

                        엔드포인트를 추가했다면 두 가지를 해야 합니다:
                          1. SPEC_API.md §10 · BACKEND_TASKS.md §6 매트릭스에 행 추가
                          2. 인가 테스트 작성 후 이 클래스의 COVERED에 등록

                        인가를 생각하지 않고 지나가는 것을 막는 것이 이 테스트의 목적이라,
                        COVERED에 그냥 넣어 통과시키지 마세요.""")
                .isEmpty();
    }

    @Test
    @DisplayName("★ 계약서에 끊어진 $ref가 없다 — FE 도구가 문서를 못 읽게 된다")
    void 계약서에_끊어진_ref가_없다() throws Exception {
        // PENDING_APPROVAL을 폐기했을 때 PostController의 ref가 남아 있었다.
        // 컴파일도 되고 테스트도 통과했지만, 문서를 기계로 읽는 쪽에서는 깨진다.
        String body = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode doc = objectMapper.readTree(body);
        List<String> dangling = new ArrayList<>();
        collectRefs(doc, dangling, doc);

        assertThat(dangling)
                .as("정의되지 않은 컴포넌트를 가리키는 $ref")
                .isEmpty();
    }

    // ── 보조 ──────────────────────────────────────────────────

    /** {@code "GET /api/posts"} 형태로 펼친다. 메서드를 안 적었으면 전부로 본다 */
    private List<String> endpointsOf(RequestMappingInfo info) {
        Set<String> patterns = info.getPathPatternsCondition() == null
                ? info.getPatternValues()
                : info.getPathPatternsCondition().getPatternValues();

        Set<String> methods = new TreeSet<>();
        info.getMethodsCondition().getMethods().forEach(m -> methods.add(m.name()));
        if (methods.isEmpty()) {
            methods.add("ANY");
        }

        List<String> endpoints = new ArrayList<>();
        for (String pattern : patterns) {
            for (String method : methods) {
                endpoints.add(method + " " + pattern);
            }
        }
        return endpoints;
    }

    private boolean isNotApplicable(String endpoint) {
        String path = endpoint.substring(endpoint.indexOf(' ') + 1);
        return NOT_APPLICABLE.stream().anyMatch(path::startsWith);
    }

    /** 문서 전체를 훑어 {@code $ref}가 실제로 존재하는 곳을 가리키는지 본다 */
    private void collectRefs(JsonNode node, List<String> dangling, JsonNode root) {
        if (node.isObject()) {
            JsonNode ref = node.get("$ref");
            if (ref != null && ref.isTextual() && !resolves(ref.asText(), root)) {
                dangling.add(ref.asText());
            }
            node.fields().forEachRemaining(e -> collectRefs(e.getValue(), dangling, root));
        } else if (node.isArray()) {
            node.forEach(child -> collectRefs(child, dangling, root));
        }
    }

    /** {@code #/components/responses/FORBIDDEN} 같은 내부 참조만 다룬다 */
    private boolean resolves(String ref, JsonNode root) {
        if (!ref.startsWith("#/")) {
            return true;    // 외부 참조는 이 테스트의 관심사가 아니다
        }
        JsonNode current = root;
        for (String segment : ref.substring(2).split("/")) {
            current = current.get(segment.replace("~1", "/").replace("~0", "~"));
            if (current == null) {
                return false;
            }
        }
        return true;
    }
}
