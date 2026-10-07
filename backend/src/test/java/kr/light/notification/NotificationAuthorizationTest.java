package kr.light.notification;

import kr.light.auth.AuthPrincipal;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import kr.light.member.Role;
import kr.light.newcomer.NewcomerRepository;
import kr.light.newcomer.NewcomerRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.time.Instant;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 인가 매트릭스 — 알림 (SPEC_API.md §10 · §14).
 *
 * <p>알림은 <b>임원(L) 이상</b>이다. 새가족 신청 목록(§8.6)과 같은 대역인데,
 * 이유가 하나 더 있다 — <b>알림 본문에 신청자 이름이 들어간다.</b> 회원에게
 * 열면 교인 명단이 아니라 <b>새로 온 사람의 이름이 회원 전체에게</b> 흘러간다.
 *
 * <p>⚠️ 클래스 이름에 {@code Authorization}이 들어가야 한다 — Jenkinsfile이
 * {@code --tests "*Authorization*"}으로 인가 테스트를 따로 먼저 돌린다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class NotificationAuthorizationTest {

    private static final String PATH = "/api/admin/notifications";
    private static final String READ_PATH = PATH + "/read";

    @Autowired MockMvc mockMvc;
    @Autowired NewcomerRepository newcomerRepository;
    @Autowired NewcomerNotificationReadRepository readRepository;
    @Autowired MemberRepository memberRepository;

    @BeforeEach
    void setUp() {
        readRepository.deleteAllInBatch();
        newcomerRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();
    }

    static Stream<Arguments> roles() {
        return Stream.of(
                arguments(null, 401, "UNAUTHORIZED"),
                // ⚠️ 여기가 열리면 새가족 이름이 회원 전체에게 보인다
                arguments(Role.MEMBER, 403, "FORBIDDEN"),
                arguments(Role.LEADER, 200, null),
                arguments(Role.PASTOR, 200, null)
        );
    }

    @ParameterizedTest(name = "GET 알림 목록 × 역할 {0} → {1}")
    @MethodSource("roles")
    void 목록_인가(Role role, int expectedStatus, String expectedCode) throws Exception {
        var result = mockMvc.perform(withRole(get(PATH), role))
                .andExpect(status().is(expectedStatus));

        if (expectedCode != null) {
            result.andExpect(jsonPath("$.error.code").value(expectedCode))
                    .andExpect(jsonPath("$.data").doesNotExist());
        }
    }

    @ParameterizedTest(name = "POST 읽음 처리 × 역할 {0} → {1}")
    @MethodSource("roles")
    void 읽음_처리_인가(Role role, int expectedStatus, String expectedCode) throws Exception {
        // ★ 본문 없이 보낸다. 본문에 검증을 걸면 회원이 403 대신 400을 받는다 —
        //   @Valid가 @PreAuthorize보다 먼저 돌기 때문이다. 그래서 이 확인이 곧
        //   NotificationReadRequest에 검증 애너테이션이 없다는 사실의 테스트다
        var result = mockMvc.perform(withRole(post(READ_PATH), role))
                .andExpect(status().is(expectedStatus));

        if (expectedCode != null) {
            result.andExpect(jsonPath("$.error.code").value(expectedCode))
                    .andExpect(jsonPath("$.data").doesNotExist());
        }
    }

    @Test
    @DisplayName("⚠️ 막힌 응답에 새가족 이름이 새지 않는다")
    void 막힌_응답이_비어_있다() throws Exception {
        newcomerRepository.saveAndFlush(NewcomerRequest.builder()
                .name("새면안됨").phone("010-9999-9999").agreedAt(Instant.now()).build());

        String anonymous = mockMvc.perform(get(PATH))
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();
        String member = mockMvc.perform(withRole(get(PATH), Role.MEMBER))
                .andExpect(status().isForbidden())
                .andReturn().getResponse().getContentAsString();

        assertThat(anonymous).doesNotContain("새면안됨");
        assertThat(member).doesNotContain("새면안됨");
    }

    @Test
    @DisplayName("★ 막힌 요청은 읽음 표시를 남기지 않는다")
    void 막힌_요청은_상태를_바꾸지_않는다() throws Exception {
        // 403이면서 표시가 찍히면, 권한 없는 계정이 남의 배지를 지울 수 있다
        mockMvc.perform(withRole(post(READ_PATH), Role.MEMBER))
                .andExpect(status().isForbidden());
        mockMvc.perform(post(READ_PATH))
                .andExpect(status().isUnauthorized());

        assertThat(readRepository.count()).isZero();
    }

    private MockHttpServletRequestBuilder withRole(MockHttpServletRequestBuilder builder, Role role) {
        if (role == null) {
            return builder;
        }
        Member actor = memberRepository.saveAndFlush(Member.builder()
                .name("행위자")
                .loginId("actor_%s".formatted(role.name().toLowerCase()))
                .role(role)
                .build());
        return builder.with(as(actor));
    }

    private RequestPostProcessor as(Member actor) {
        AuthPrincipal principal = new AuthPrincipal(actor.getId(), actor.getRole());
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities());
        return authentication(authentication);
    }
}
