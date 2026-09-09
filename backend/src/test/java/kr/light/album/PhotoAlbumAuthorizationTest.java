package kr.light.album;

import kr.light.auth.AuthPrincipal;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import kr.light.member.Role;
import kr.light.storage.R2Client;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.stream.Stream;

import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 사진첩 인가 (SPEC_API.md §10 · §6).
 *
 * <p><b>★ 열람은 회원(M)부터다.</b> §6 본문에는 아직 {@code 권한 G}로 적혀
 * 있지만 <b>§10 인가 매트릭스(테스트 기준)가 401</b>이고, 2026-08-31
 * "열람 M 복귀" 결정이 사진첩을 명시한다. 본문 표기가 그때 갱신되지 않은
 * 것이라 매트릭스를 따랐다 — 두 문서가 어긋날 때 무엇이 기준인지 여기에
 * 남겨 둔다.
 *
 * <p>쓰기(앨범 생성·삭제 · 업로드 · 사진 삭제)는 임원(L)이다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PhotoAlbumAuthorizationTest {

    private static final long ANY_ID = 999999L;

    @Autowired MockMvc mockMvc;
    @Autowired MemberRepository memberRepository;

    /** R2를 부르지 않는다 — 인가가 그 앞에서 갈린다 */
    @MockitoBean R2Client r2Client;

    @BeforeEach
    void setUp() {
        memberRepository.deleteAllInBatch();
    }

    /** 열람 — 회원(M) 이상 */
    static Stream<Arguments> readRoles() {
        return Stream.of(
                arguments(null,        401, "UNAUTHORIZED"),
                arguments(Role.MEMBER, 0,   null),
                arguments(Role.LEADER, 0,   null),
                arguments(Role.PASTOR, 0,   null)
        );
    }

    /** 쓰기 — 임원(L) 이상 */
    static Stream<Arguments> writeRoles() {
        return Stream.of(
                arguments(null,        401, "UNAUTHORIZED"),
                arguments(Role.MEMBER, 403, "FORBIDDEN"),
                arguments(Role.LEADER, 0,   null),
                arguments(Role.PASTOR, 0,   null)
        );
    }

    @ParameterizedTest(name = "GET albums × {0} → {1}")
    @MethodSource("readRoles")
    void 앨범_목록(Role role, int status, String code) throws Exception {
        gate(get("/api/albums"), role, status, code);
    }

    @ParameterizedTest(name = "GET album photos × {0} → {1}")
    @MethodSource("readRoles")
    void 사진_목록(Role role, int status, String code) throws Exception {
        gate(get("/api/albums/" + ANY_ID + "/photos"), role, status, code);
    }

    @ParameterizedTest(name = "GET photo download × {0} → {1}")
    @MethodSource("readRoles")
    void 사진_다운로드(Role role, int status, String code) throws Exception {
        gate(get("/api/photos/" + ANY_ID + "/download"), role, status, code);
    }

    @ParameterizedTest(name = "POST albums × {0} → {1}")
    @MethodSource("writeRoles")
    void 앨범_생성(Role role, int status, String code) throws Exception {
        gate(post("/api/albums")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"테스트\"}"), role, status, code);
    }

    @ParameterizedTest(name = "DELETE album × {0} → {1}")
    @MethodSource("writeRoles")
    void 앨범_삭제(Role role, int status, String code) throws Exception {
        gate(delete("/api/albums/" + ANY_ID), role, status, code);
    }

    @ParameterizedTest(name = "DELETE photo × {0} → {1}")
    @MethodSource("writeRoles")
    void 사진_삭제(Role role, int status, String code) throws Exception {
        gate(delete("/api/photos/" + ANY_ID), role, status, code);
    }

    @ParameterizedTest(name = "POST uploads:issue × {0} → {1}")
    @MethodSource("writeRoles")
    void 업로드_발급(Role role, int status, String code) throws Exception {
        // ⚠️ 유효한 본문을 보낸다. 빈 배열을 보내면 MEMBER가 403이 아니라
        //    400을 받는다 — @Valid 본문 검증이 컨트롤러 진입 전에 돌아
        //    메서드 단위 @PreAuthorize보다 **먼저** 판정되기 때문이다.
        //    (효력은 그대로다. 로그인한 회원이 검증 문구를 볼 수 있을 뿐이다.)
        gate(post("/api/uploads:issue")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"albumId":"1","files":[{"clientId":"f1","sizeBytes":10,
                         "thumbSizeBytes":5,"width":100,"height":100}]}
                        """), role, status, code);
    }

    @ParameterizedTest(name = "POST uploads:commit × {0} → {1}")
    @MethodSource("writeRoles")
    void 업로드_확정(Role role, int status, String code) throws Exception {
        gate(post("/api/uploads:commit")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"photoIds\":[\"1\"]}"), role, status, code);
    }

    @Test
    @DisplayName("★ 클래스 단위 @PreAuthorize라 새 메서드를 추가해도 기본이 막힘이다")
    void 클래스_단위로_걸려_있다() throws Exception {
        mockMvc.perform(get("/api/albums/anything")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/photos/anything")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("⚠️ 막힌 응답에 사진 주소가 새지 않는다")
    void 막힌_응답이_비어_있다() throws Exception {
        String body = mockMvc.perform(get("/api/albums"))
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();

        org.assertj.core.api.Assertions.assertThat(body)
                .doesNotContain("thumbUrl").doesNotContain("X-Amz");
    }

    // ── 보조 ─────────────────────────────────────────────────

    private void gate(MockHttpServletRequestBuilder builder, Role role,
                      int expectedStatus, String expectedCode) throws Exception {
        var result = mockMvc.perform(role == null ? builder : builder.with(as(role)));

        if (expectedCode == null) {
            // 통과 — 그 뒤 결과(200/400/404/…)는 인가의 관심사가 아니다
            result.andExpect(status().is(
                    org.hamcrest.Matchers.not(org.hamcrest.Matchers.isOneOf(401, 403))));
        } else {
            result.andExpect(status().is(expectedStatus))
                    .andExpect(jsonPath("$.error.code").value(expectedCode));
        }
    }

    private RequestPostProcessor as(Role role) {
        Member actor = memberRepository.saveAndFlush(Member.builder()
                .name("행위자")
                .loginId("actor_%s".formatted(role.name().toLowerCase()))
                .role(role)
                .build());

        AuthPrincipal principal = new AuthPrincipal(actor.getId(), role);
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities());
        return authentication(authentication);
    }
}
