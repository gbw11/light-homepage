package kr.light.bulletin;

import com.fasterxml.jackson.databind.ObjectMapper;
import kr.light.attachment.AttachmentRepository;
import kr.light.auth.AuthPrincipal;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import kr.light.member.Role;
import kr.light.storage.R2Client;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.Collection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 주보 (SPEC_API.md §5).
 *
 * <p>⚠️ <b>R2를 실제로 부르지 않는다</b> — {@link R2Client}를 가로챈다. 진짜
 * 버킷에 붙이면 테스트가 네트워크와 요금에 묶이고, CI에서는 키가 없어 통째로
 * 실패한다. 여기서 확인하는 것은 <b>"R2에 무엇을 시켰는가"</b>다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BulletinApiTest {

    private static final String PRESIGNED = "https://r2.example/presigned?X-Amz-Signature=stub";

    @Autowired MockMvc mockMvc;
    @Autowired BulletinRepository bulletinRepository;
    @Autowired AttachmentRepository attachmentRepository;
    @Autowired MemberRepository memberRepository;
    @Autowired ObjectMapper objectMapper;

    @MockitoBean R2Client r2Client;

    private Member leader;

    @BeforeEach
    void setUp() {
        attachmentRepository.deleteAllInBatch();
        bulletinRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();

        given(r2Client.presignedGetUrl(anyString())).willReturn(PRESIGNED);

        leader = memberRepository.saveAndFlush(Member.builder()
                .name("시드임원").loginId("leader").role(Role.LEADER).build());
    }

    // ── §5.4 업로드 ──────────────────────────────────────────

    @Nested
    @DisplayName("업로드")
    class Upload {

        @Test
        @DisplayName("올리면 201과 id·pageCount가 온다")
        void 업로드() throws Exception {
            mockMvc.perform(upload("2026-08-24", page(1), page(2)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.data.id").isString())
                    .andExpect(jsonPath("$.data.pageCount").value(2));

            assertThat(bulletinRepository.count()).isEqualTo(1);
            assertThat(attachmentRepository.count()).isEqualTo(2);
        }

        @Test
        @DisplayName("★ 배열 순서가 그대로 페이지 번호다 — 정렬 기준이 따로 없다")
        void 순서가_페이지번호() throws Exception {
            String id = createBulletin("2026-08-24", page(1), page(2), page(3));

            mockMvc.perform(get("/api/bulletins/" + id))
                    .andExpect(jsonPath("$.data.pages[0].pageNo").value(1))
                    .andExpect(jsonPath("$.data.pages[1].pageNo").value(2))
                    .andExpect(jsonPath("$.data.pages[2].pageNo").value(3));
        }

        @Test
        @DisplayName("★ R2 키에 업로드 파일명을 쓰지 않는다 — 경로 탈출을 막는다")
        void 키를_서버가_만든다() throws Exception {
            var evil = new MockMultipartFile(
                    "pages", "../../etc/passwd.webp", "image/webp", "x".getBytes());

            mockMvc.perform(upload("2026-08-24", evil)).andExpect(status().isCreated());

            ArgumentCaptor<String> key = ArgumentCaptor.forClass(String.class);
            verify(r2Client).put(key.capture(), any(org.springframework.web.multipart.MultipartFile.class));
            assertThat(key.getValue())
                    .doesNotContain("..").doesNotContain("passwd")
                    .matches("bulletins/\\d+/1\\.webp");
        }

        @Test
        @DisplayName("★ 같은 날짜는 DUPLICATE — 서버가 조용히 덮어쓰지 않는다")
        void 중복_날짜() throws Exception {
            createBulletin("2026-08-24", page(1));

            mockMvc.perform(upload("2026-08-24", page(1)))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.error.code").value("DUPLICATE"))
                    .andExpect(jsonPath("$.error.field").value("serviceDate"));

            assertThat(bulletinRepository.count()).isEqualTo(1);
        }

        @Test
        @DisplayName("⚠️ 중복이면 R2에 올리지 않는다 — 올려두고 실패하면 고아 객체가 남는다")
        void 중복이면_올리지_않는다() throws Exception {
            createBulletin("2026-08-24", page(1));
            org.mockito.Mockito.clearInvocations(r2Client);

            mockMvc.perform(upload("2026-08-24", page(1))).andExpect(status().isConflict());

            verify(r2Client, never()).put(anyString(),
                    any(org.springframework.web.multipart.MultipartFile.class));
        }

        @Test
        @DisplayName("이미지가 아니면 400 — 뷰어가 그대로 여는 값이다")
        void 이미지가_아니면_거부() throws Exception {
            var html = new MockMultipartFile("pages", "x.html", "text/html", "<script>".getBytes());

            mockMvc.perform(upload("2026-08-24", html))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.field").value("pages"));
        }

        @Test
        @DisplayName("SVG도 거부한다 — 이미지지만 스크립트가 들어간다")
        void svg_거부() throws Exception {
            var svg = new MockMultipartFile("pages", "x.svg", "image/svg+xml", "<svg>".getBytes());

            mockMvc.perform(upload("2026-08-24", svg))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("페이지가 없으면 400")
        void 페이지_없음() throws Exception {
            mockMvc.perform(multipart("/api/bulletins")
                            .param("serviceDate", "2026-08-24")
                            .with(as(leader)))
                    .andExpect(status().isBadRequest());
        }
    }

    // ── §5.1 · §5.2 · §5.3 조회 ──────────────────────────────

    @Nested
    @DisplayName("조회")
    class Read {

        @Test
        @DisplayName("★ 주보가 없으면 data가 null이다 — 404가 아니다")
        void 없으면_null() throws Exception {
            mockMvc.perform(get("/api/bulletins/latest"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data").doesNotExist());
        }

        @Test
        @DisplayName("latest는 가장 최근 주일이다")
        void 최신() throws Exception {
            createBulletin("2026-08-10", page(1));
            createBulletin("2026-08-24", page(1));
            createBulletin("2026-08-17", page(1));

            mockMvc.perform(get("/api/bulletins/latest"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.serviceDate").value("2026-08-24"));
        }

        @Test
        @DisplayName("목록은 최근 주일이 위다")
        void 목록_정렬() throws Exception {
            createBulletin("2026-08-10", page(1));
            createBulletin("2026-08-24", page(1), page(2));

            mockMvc.perform(get("/api/bulletins"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.items[0].serviceDate").value("2026-08-24"))
                    .andExpect(jsonPath("$.data.items[0].pageCount").value(2))
                    .andExpect(jsonPath("$.data.items[1].serviceDate").value("2026-08-10"));
        }

        @Test
        @DisplayName("presigned URL이 실려 나간다 — R2 키는 나가지 않는다")
        void 키가_새지_않는다() throws Exception {
            String id = createBulletin("2026-08-24", page(1));

            String body = mockMvc.perform(get("/api/bulletins/" + id))
                    .andExpect(jsonPath("$.data.pages[0].url").value(PRESIGNED))
                    .andReturn().getResponse().getContentAsString();

            // ⚠️ R2 키가 응답에 있으면 버킷 구조가 드러난다
            assertThat(body).doesNotContain("bulletins/").doesNotContain("r2Key");
        }

        @Test
        @DisplayName("없는 주보는 404")
        void 없는_주보() throws Exception {
            mockMvc.perform(get("/api/bulletins/999999"))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("주보가 없으면 목록은 빈 배열이다")
        void 빈_목록() throws Exception {
            mockMvc.perform(get("/api/bulletins"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.items").isEmpty());
        }
    }

    // ── §5.5 삭제 ────────────────────────────────────────────

    @Test
    @DisplayName("★ 삭제하면 R2 객체도 함께 지운다 — 남기면 용량이 조용히 샌다")
    void 삭제() throws Exception {
        String id = createBulletin("2026-08-24", page(1), page(2));

        mockMvc.perform(delete("/api/bulletins/" + id).with(as(leader)))
                .andExpect(status().isNoContent());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Collection<String>> keys = ArgumentCaptor.forClass(Collection.class);
        verify(r2Client).deleteAll(keys.capture());
        assertThat(keys.getValue()).hasSize(2);

        assertThat(bulletinRepository.count()).isZero();
        assertThat(attachmentRepository.count()).isZero();
    }

    @Test
    @DisplayName("없는 주보 삭제는 404")
    void 없는_주보_삭제() throws Exception {
        mockMvc.perform(delete("/api/bulletins/999999").with(as(leader)))
                .andExpect(status().isNotFound());
    }

    // ── 보조 ─────────────────────────────────────────────────

    private MockMultipartFile page(int pageNo) {
        return new MockMultipartFile(
                "pages", pageNo + ".webp", "image/webp", ("page-" + pageNo).getBytes());
    }

    private MockMultipartHttpServletRequestBuilder upload(String serviceDate, MockMultipartFile... pages) {
        var builder = multipart("/api/bulletins");
        for (MockMultipartFile page : pages) {
            builder.file(page);
        }
        builder.param("serviceDate", serviceDate);
        builder.with(as(leader));
        return builder;
    }

    private String createBulletin(String serviceDate, MockMultipartFile... pages) throws Exception {
        String body = mockMvc.perform(upload(serviceDate, pages))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).path("data").path("id").asText();
    }

    private RequestPostProcessor as(Member actor) {
        AuthPrincipal principal = new AuthPrincipal(actor.getId(), actor.getRole());
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities());
        return authentication(authentication);
    }
}
