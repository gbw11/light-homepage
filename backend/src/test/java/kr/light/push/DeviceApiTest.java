package kr.light.push;

import kr.light.auth.AuthPrincipal;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import kr.light.member.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 기기 등록 · 해제 (SPEC_API.md §15.2) */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DeviceApiTest {

    @Autowired MockMvc mockMvc;
    @Autowired MemberRepository memberRepository;
    @Autowired MemberDeviceRepository deviceRepository;
    @Autowired TransactionTemplate transaction;

    Member alice;
    Member bob;

    @BeforeEach
    void setUp() {
        deviceRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();
        alice = save("앨리스", "alice");
        bob = save("밥", "bob");
    }

    @Test
    @DisplayName("등록하면 내 계정에 한 줄이 생긴다")
    void 등록() throws Exception {
        register(alice, "token-1");

        assertThat(ownerOf("token-1")).isEqualTo(alice.getId());
    }

    @Test
    @DisplayName("같은 토큰을 여러 번 등록해도 한 줄이다 (앱을 켤 때마다 부른다)")
    void 멱등() throws Exception {
        register(alice, "token-1");
        register(alice, "token-1");
        register(alice, "token-1");

        assertThat(deviceRepository.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("★ 같은 폰에서 다른 사람이 로그인하면 토큰의 주인이 옮겨진다")
    void 주인_옮김() throws Exception {
        register(alice, "token-1");
        register(bob, "token-1");

        assertThat(deviceRepository.count()).isEqualTo(1);
        assertThat(ownerOf("token-1")).isEqualTo(bob.getId());
    }

    @Test
    @DisplayName("해제는 내 기기만 지운다 — 남의 토큰은 그대로 두고 똑같이 204")
    void 해제() throws Exception {
        register(alice, "token-a");
        register(bob, "token-b");

        mockMvc.perform(delete("/api/me/devices/token-b").with(as(alice)))
                .andExpect(status().isNoContent());
        assertThat(deviceRepository.findByToken("token-b")).isPresent();

        mockMvc.perform(delete("/api/me/devices/token-a").with(as(alice)))
                .andExpect(status().isNoContent());
        assertThat(deviceRepository.findByToken("token-a")).isEmpty();
    }

    @Test
    @DisplayName("FCM 토큰에 들어가는 ':' 도 주소에서 그대로 지운다")
    void 콜론_토큰() throws Exception {
        String token = "dGVzdA:APA91bH-abc_def";
        register(alice, token);

        mockMvc.perform(delete("/api/me/devices/" + token).with(as(alice)))
                .andExpect(status().isNoContent());
        assertThat(deviceRepository.findByToken(token)).isEmpty();
    }

    @Test
    @DisplayName("토큰 · 기기 종류가 없으면 400")
    void 검증() throws Exception {
        mockMvc.perform(post("/api/me/devices").with(as(alice))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"platform\":\"ANDROID\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.field").value("token"));
        mockMvc.perform(post("/api/me/devices").with(as(alice))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"t\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.field").value("platform"));
    }

    @Test
    @DisplayName("계정이 지워지면 기기도 함께 사라진다 (FK CASCADE)")
    void 계정_삭제() throws Exception {
        register(alice, "token-1");

        memberRepository.deleteById(alice.getId());

        assertThat(deviceRepository.count()).isZero();
    }

    private void register(Member who, String token) throws Exception {
        mockMvc.perform(post("/api/me/devices").with(as(who))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"%s\",\"platform\":\"ANDROID\"}".formatted(token)))
                .andExpect(status().isNoContent());
    }

    private Long ownerOf(String token) {
        return transaction.execute(status ->
                deviceRepository.findByToken(token).orElseThrow().getMember().getId());
    }

    private Member save(String name, String loginId) {
        return memberRepository.saveAndFlush(Member.builder()
                .name(name).loginId(loginId).role(Role.MEMBER).build());
    }

    private static RequestPostProcessor as(Member who) {
        AuthPrincipal principal = new AuthPrincipal(who.getId(), who.getRole());
        return authentication(new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities()));
    }
}
