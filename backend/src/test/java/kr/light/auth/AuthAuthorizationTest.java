package kr.light.auth;

import kr.light.member.Role;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.access.hierarchicalroles.RoleHierarchy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 인가 매트릭스 — 인증 경로와 역할 계층 (ARCHITECTURE.md §5.1 · §5.3).
 *
 * <p>Jenkinsfile이 {@code --tests "*Authorization*"}으로 골라 돌린다 —
 * <b>이름에서 {@code Authorization}을 빼면 CI가 찾지 못한다.</b>
 *
 * <p>여기서 지키는 것은 두 가지다.
 * <ol>
 *   <li><b>인증을 얻기 위한 경로만 열려 있는가.</b> {@code /api/auth/**}를
 *       뭉뚱그려 열면 앞으로 추가될 {@code PATCH /api/auth/me}(권한 M)까지
 *       함께 열린다.</li>
 *   <li><b>역할 계층이 실제로 걸려 있는가.</b> 안 걸리면 엔드포인트마다 상위
 *       역할을 나열해야 하고, 빠뜨리면 전도사가 임원 기능을 못 쓴다.</li>
 * </ol>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthAuthorizationTest {

    @Autowired MockMvc mockMvc;
    @Autowired RoleHierarchy roleHierarchy;

    // ── 열려 있어야 하는 경로 ──────────────────────────────────

    @Test
    @DisplayName("명단 확인·가입·로그인·재발급·로그아웃은 비로그인으로 통과한다")
    void 인증을_얻는_경로는_열려_있다() throws Exception {
        // 본문이 비어 400이 나도 좋다. 401 UNAUTHORIZED로 "필터에 막힌 것"만
        // 아니면 된다 — 막혔다면 가입·로그인 자체가 불가능해진다.
        mockMvc.perform(post("/api/auth/verify-roster").contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/auth/register").contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/auth/login").contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest());

        // 리프레시 쿠키가 없으니 401이지만, 이건 서비스가 낸 것이지 필터가 막은 게 아니다
        mockMvc.perform(post("/api/auth/refresh"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/auth/logout"))
                .andExpect(status().isNoContent());
    }

    // ── 막혀 있어야 하는 경로 ──────────────────────────────────

    @Test
    @DisplayName("/me는 로그인이 필요하다")
    void me는_보호된다() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("경로를 뭉뚱그려 열지 않았다 — 앞으로 추가될 /api/auth 하위는 막혀 있다")
    void auth_하위가_통째로_열리지_않았다() throws Exception {
        // PATCH /api/auth/me(§2.11)·DELETE /api/auth/me(§2.13)·비밀번호 변경(§2.12)은
        // 전부 권한 M이다. 아직 구현 전이지만, 지금 경로가 열려 있으면
        // 만드는 순간 무방비로 공개된다.
        mockMvc.perform(get("/api/auth/password/change"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/auth/anything-else"))
                .andExpect(status().isUnauthorized());
    }

    // ── 역할 계층 (ARCHITECTURE.md §5.1) ───────────────────────

    @Test
    @DisplayName("PASTOR는 LEADER·MEMBER를 포함한다")
    void 전도사는_상위다() {
        assertThat(reachableFrom(Role.PASTOR))
                .contains("ROLE_PASTOR", "ROLE_LEADER", "ROLE_MEMBER");
    }

    @Test
    @DisplayName("LEADER는 MEMBER를 포함하지만 PASTOR는 아니다")
    void 임원은_회원을_포함한다() {
        assertThat(reachableFrom(Role.LEADER))
                .contains("ROLE_LEADER", "ROLE_MEMBER")
                .doesNotContain("ROLE_PASTOR");
    }

    @Test
    @DisplayName("MEMBER는 자기 자신뿐이다")
    void 회원은_상위를_얻지_못한다() {
        assertThat(reachableFrom(Role.MEMBER))
                .containsExactly("ROLE_MEMBER");
    }

    @Test
    @DisplayName("★ 역할 계층은 위로만 흐른다 — MEMBER가 LEADER 권한을 얻지 않는다")
    void 계층은_아래로만_포함한다() {
        // v1.3에서 PENDING이 사라져 "가입만 한 사람" 층은 없다. 남은 위험은
        // 계층을 거꾸로 걸어 하위 역할이 상위 권한을 얻는 것이다.
        assertThat(reachableFrom(Role.MEMBER))
                .containsExactly("ROLE_MEMBER");
        assertThat(reachableFrom(Role.PASTOR))
                .contains("ROLE_PASTOR", "ROLE_LEADER", "ROLE_MEMBER");
    }

    private List<String> reachableFrom(Role role) {
        return roleHierarchy
                .getReachableGrantedAuthorities(List.of(new SimpleGrantedAuthority("ROLE_" + role.name())))
                .stream()
                .map(org.springframework.security.core.GrantedAuthority::getAuthority)
                .toList();
    }
}
