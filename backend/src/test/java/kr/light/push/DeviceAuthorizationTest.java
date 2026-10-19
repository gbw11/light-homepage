package kr.light.push;

import kr.light.auth.AuthPrincipal;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import kr.light.member.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 기기 등록 · 해제 인가 (SPEC_API.md §15.2 · §10). 로그인한 회원 누구나(M).
 *
 * <p>이름에 {@code Authorization}이 들어간다 — Jenkins가 이 패턴으로 늘 돌린다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DeviceAuthorizationTest {

    private static final String BODY = """
            {"token":"fcm-token-abc","platform":"ANDROID"}""";

    @Autowired MockMvc mockMvc;
    @Autowired MemberRepository memberRepository;
    @Autowired MemberDeviceRepository deviceRepository;

    @BeforeEach
    void setUp() {
        deviceRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();
    }

    @Test
    @DisplayName("POST /api/me/devices × 비로그인 → 401")
    void 등록_비로그인() throws Exception {
        mockMvc.perform(post("/api/me/devices")
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("DELETE /api/me/devices/{token} × 비로그인 → 401")
    void 해제_비로그인() throws Exception {
        mockMvc.perform(delete("/api/me/devices/fcm-token-abc"))
                .andExpect(status().isUnauthorized());
    }

    @ParameterizedTest(name = "POST · DELETE /api/me/devices × {0} → 204")
    @EnumSource(Role.class)
    @DisplayName("회원 · 임원 · 전도사 모두 자기 기기를 등록 · 해제한다")
    void 로그인하면_누구나(Role role) throws Exception {
        Member who = memberRepository.saveAndFlush(Member.builder()
                .name("회원").loginId("m-" + role).role(role).build());

        mockMvc.perform(post("/api/me/devices").with(as(who))
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/me/devices/fcm-token-abc").with(as(who)))
                .andExpect(status().isNoContent());
    }

    private static RequestPostProcessor as(Member who) {
        AuthPrincipal principal = new AuthPrincipal(who.getId(), who.getRole());
        return authentication(new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities()));
    }
}
