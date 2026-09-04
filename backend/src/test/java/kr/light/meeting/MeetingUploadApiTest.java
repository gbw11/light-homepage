package kr.light.meeting;

import kr.light.auth.AuthPrincipal;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import kr.light.member.Role;
import kr.light.storage.R2Client;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.io.ByteArrayOutputStream;
import java.util.Collection;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 월례회 업로드 — PDF → 이미지 변환 (SPEC_API.md §7.4~§7.6).
 *
 * <p>이 테스트는 <b>진짜 PDF를 만들어서</b> 넣는다. PDFBox 변환은 목으로
 * 대체하면 확인되는 게 없다 — 실제로 열리는지, 몇 쪽인지, 이미지가 나오는지가
 * 전부 그 안에서 일어난다.
 *
 * <p>⚠️ R2만 가로챈다. 진짜 버킷에 붙이면 테스트가 네트워크와 요금에 묶인다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MeetingUploadApiTest {

    @Autowired MockMvc mockMvc;
    @Autowired MeetingDocRepository meetingDocRepository;
    @Autowired MeetingDocPageRepository meetingDocPageRepository;
    @Autowired MemberRepository memberRepository;

    @MockitoBean R2Client r2Client;

    private Member leader;

    @BeforeEach
    void setUp() {
        meetingDocPageRepository.deleteAllInBatch();
        meetingDocRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();

        leader = memberRepository.saveAndFlush(Member.builder()
                .name("시드임원").loginId("leader").role(Role.LEADER).build());
    }

    // ── §7.4 업로드 ──────────────────────────────────────────

    @Test
    @DisplayName("★ PDF가 페이지 이미지로 바뀐다 — 쪽수가 그대로 나온다")
    void 변환() throws Exception {
        mockMvc.perform(upload(pdf(3)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").isString())
                .andExpect(jsonPath("$.data.pageCount").value(3));

        assertThat(meetingDocRepository.findAll()).singleElement()
                .satisfies(doc -> assertThat(doc.getPageCount()).isEqualTo(3));
        assertThat(meetingDocPageRepository.count()).isEqualTo(3);
    }

    @Test
    @DisplayName("★ 페이지마다 즉시 R2로 넘긴다 — 모아두면 512MB에서 터진다")
    void 한_장씩_올린다() throws Exception {
        mockMvc.perform(upload(pdf(3))).andExpect(status().isCreated());

        ArgumentCaptor<String> keys = ArgumentCaptor.forClass(String.class);
        verify(r2Client, org.mockito.Mockito.times(3))
                .put(keys.capture(), any(java.io.InputStream.class), anyLong(), anyString());

        assertThat(keys.getAllValues())
                .allMatch(key -> key.matches("meetings/\\d+/\\d+\\.jpg"))
                .hasSize(3);
    }

    @Test
    @DisplayName("페이지 순서가 PDF 순서를 따른다")
    void 순서() throws Exception {
        String id = uploadAndGetId(pdf(4));

        List<MeetingDocPage> pages =
                meetingDocPageRepository.findByDocIdOrderByPageNoAsc(Long.valueOf(id));

        assertThat(pages).extracting(MeetingDocPage::getPageNo)
                .containsExactly(1, 2, 3, 4);
    }

    @Test
    @DisplayName("★ 이미지 크기가 기록된다 — 용량 집계(§8.5)의 근거다")
    void 크기_기록() throws Exception {
        String id = uploadAndGetId(pdf(1));

        assertThat(meetingDocPageRepository.findByDocIdOrderByPageNoAsc(Long.valueOf(id)))
                .singleElement()
                .satisfies(page -> assertThat(page.getSizeBytes()).isPositive());
    }

    @Test
    @DisplayName("PDF가 아니면 400 — field는 file이다")
    void pdf가_아니면() throws Exception {
        var notPdf = new MockMultipartFile(
                "file", "문서.pdf", "application/pdf", "이건 PDF가 아니다".getBytes());

        mockMvc.perform(upload(notPdf))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.field").value("file"));
    }

    @Test
    @DisplayName("⚠️ 변환이 실패하면 R2에 아무것도 올리지 않는다")
    void 실패하면_안_올린다() throws Exception {
        var notPdf = new MockMultipartFile(
                "file", "문서.pdf", "application/pdf", "깨진 파일".getBytes());

        mockMvc.perform(upload(notPdf)).andExpect(status().isBadRequest());

        verify(r2Client, never()).put(anyString(), any(java.io.InputStream.class),
                anyLong(), anyString());
    }

    @Test
    @DisplayName("파일이 없으면 400")
    void 파일_없음() throws Exception {
        mockMvc.perform(multipart("/api/meetings").with(as(leader))
                        .param("title", "제목")
                        .param("meetingDate", "2026-08-24")
                        .param("viewableFrom", "2026-08-24T11:00:00Z")
                        .param("viewableUntil", "2026-08-26T14:59:00Z"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.field").value("file"));
    }

    @Test
    @DisplayName("★ 종료가 시작보다 앞서면 400 — DB CHECK 전에 이유를 알려준다")
    void 잘못된_기간() throws Exception {
        var request = multipart("/api/meetings").file(pdf(1)).with(as(leader))
                .param("title", "제목")
                .param("meetingDate", "2026-08-24")
                .param("viewableFrom", "2026-08-26T14:59:00Z")
                .param("viewableUntil", "2026-08-24T11:00:00Z");

        mockMvc.perform(request)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.field").value("viewableUntil"));
    }

    @Test
    @DisplayName("제목이 비면 400")
    void 빈_제목() throws Exception {
        var request = multipart("/api/meetings").file(pdf(1)).with(as(leader))
                .param("title", "  ")
                .param("meetingDate", "2026-08-24")
                .param("viewableFrom", "2026-08-24T11:00:00Z")
                .param("viewableUntil", "2026-08-26T14:59:00Z");

        mockMvc.perform(request)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.field").value("title"));
    }

    // ── §7.5 기간 수정 ───────────────────────────────────────

    @Test
    @DisplayName("기간을 바꿀 수 있다 — 자료를 다시 올리지 않는다")
    void 기간_수정() throws Exception {
        String id = uploadAndGetId(pdf(1));

        mockMvc.perform(patch("/api/meetings/" + id + "/window").with(as(leader))
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("""
                                {"viewableFrom":"2026-09-01T00:00:00Z",
                                 "viewableUntil":"2026-09-30T00:00:00Z"}
                                """))
                .andExpect(status().isNoContent());

        assertThat(meetingDocRepository.findById(Long.valueOf(id)).orElseThrow()
                .getViewableUntil()).isEqualTo(java.time.Instant.parse("2026-09-30T00:00:00Z"));
    }

    @Test
    @DisplayName("기간 수정도 종료가 시작보다 뒤여야 한다")
    void 기간_수정_검증() throws Exception {
        String id = uploadAndGetId(pdf(1));

        mockMvc.perform(patch("/api/meetings/" + id + "/window").with(as(leader))
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("""
                                {"viewableFrom":"2026-09-30T00:00:00Z",
                                 "viewableUntil":"2026-09-01T00:00:00Z"}
                                """))
                .andExpect(status().isBadRequest());
    }

    // ── §7.6 삭제 ────────────────────────────────────────────

    @Test
    @DisplayName("★ 삭제하면 페이지 이미지까지 사라진다")
    void 삭제() throws Exception {
        String id = uploadAndGetId(pdf(3));

        mockMvc.perform(delete("/api/meetings/" + id).with(as(leader)))
                .andExpect(status().isNoContent());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Collection<String>> keys = ArgumentCaptor.forClass(Collection.class);
        verify(r2Client).deleteAll(keys.capture());
        assertThat(keys.getValue()).hasSize(3);

        assertThat(meetingDocRepository.count()).isZero();
        assertThat(meetingDocPageRepository.count()).isZero();
    }

    // ── 인가 ─────────────────────────────────────────────────

    @Test
    @DisplayName("★ 회원은 업로드할 수 없다 — 관리 경로는 임원이다")
    void 회원은_못_올린다() throws Exception {
        Member member = memberRepository.saveAndFlush(Member.builder()
                .name("시드회원").loginId("member").role(Role.MEMBER).build());

        var request = multipart("/api/meetings").file(pdf(1)).with(as(member))
                .param("title", "제목")
                .param("meetingDate", "2026-08-24")
                .param("viewableFrom", "2026-08-24T11:00:00Z")
                .param("viewableUntil", "2026-08-26T14:59:00Z");

        mockMvc.perform(request).andExpect(status().isForbidden());
    }

    // ── 보조 ─────────────────────────────────────────────────

    /** 진짜 PDF를 만든다 — 변환을 실제로 태워야 확인되는 것이 있다 */
    private MockMultipartFile pdf(int pageCount) throws Exception {
        try (PDDocument document = new PDDocument();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            for (int i = 1; i <= pageCount; i++) {
                PDPage page = new PDPage(PDRectangle.A4);
                document.addPage(page);
                try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                    content.beginText();
                    content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 24);
                    content.newLineAtOffset(72, 700);
                    content.showText("Meeting page " + i);
                    content.endText();
                }
            }
            document.save(out);
            return new MockMultipartFile("file", "월례회.pdf", "application/pdf", out.toByteArray());
        }
    }

    private MockHttpServletRequestBuilder upload(MockMultipartFile file) {
        return multipart("/api/meetings").file(file).with(as(leader))
                .param("title", "2026년 8월 월례회")
                .param("meetingDate", "2026-08-24")
                .param("viewableFrom", "2026-08-24T11:00:00Z")
                .param("viewableUntil", "2026-08-26T14:59:00Z");
    }

    private String uploadAndGetId(MockMultipartFile file) throws Exception {
        String body = mockMvc.perform(upload(file))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return new com.fasterxml.jackson.databind.ObjectMapper()
                .readTree(body).path("data").path("id").asText();
    }

    private RequestPostProcessor as(Member actor) {
        AuthPrincipal principal = new AuthPrincipal(actor.getId(), actor.getRole());
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities());
        return authentication(authentication);
    }
}
