package kr.light.meeting;

import kr.light.auth.AuthPrincipal;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import kr.light.member.Role;
import kr.light.storage.R2Client;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 월례회 페이지 스트리밍 (SPEC_API.md §7.3) + 열람 기록 (§7.7).
 *
 * <p>여기서 확인하는 것 셋:
 * <ul>
 *   <li><b>기간 관문</b> — 기간 밖 회원은 403, 임원은 통과</li>
 *   <li><b>응답이 이미지</b>이고 캐시가 금지되는가 — 워터마크에 열람시각이
 *       들어가므로 캐시되면 남의 워터마크가 박힌 페이지를 보게 된다</li>
 *   <li><b>열람이 기록되는가</b> — 유출 시 대조할 유일한 근거다</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MeetingPageStreamTest {

    @Autowired MockMvc mockMvc;
    @Autowired MeetingDocRepository meetingDocRepository;
    @Autowired MeetingDocPageRepository pageRepository;
    @Autowired MeetingDocViewRepository viewRepository;
    @Autowired MemberRepository memberRepository;
    @Autowired WatermarkPainter watermarkPainter;

    @MockitoBean R2Client r2Client;

    private Member member;
    private Member leader;

    @BeforeEach
    void setUp() throws Exception {
        viewRepository.deleteAllInBatch();
        pageRepository.deleteAllInBatch();
        meetingDocRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();

        // R2에는 진짜 JPEG가 있어야 한다 — 워터마크 합성이 실제로 돌아야 하므로
        given(r2Client.read(anyString())).willReturn(blankJpeg());

        member = memberRepository.saveAndFlush(Member.builder()
                .name("김도연").loginId("member").phone("010-1234-5678")
                .role(Role.MEMBER).build());
        leader = memberRepository.saveAndFlush(Member.builder()
                .name("시드임원").loginId("leader").role(Role.LEADER).build());
    }

    // ── §7.3 스트리밍 ────────────────────────────────────────

    @Test
    @DisplayName("★ 응답이 JSON이 아니라 이미지 바이너리다")
    void 이미지가_나온다() throws Exception {
        Long id = saveDoc(openWindow());

        byte[] body = mockMvc.perform(get("/api/meetings/" + id + "/pages/1").with(as(member)))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/jpeg"))
                .andReturn().getResponse().getContentAsByteArray();

        // 실제로 열리는 이미지여야 한다 — 바이트만 왔는지가 아니라
        BufferedImage image = ImageIO.read(new ByteArrayInputStream(body));
        assertThat(image).isNotNull();
        assertThat(image.getWidth()).isPositive();
    }

    @Test
    @DisplayName("★ 캐시가 금지된다 — 워터마크에 열람시각이 들어 있다")
    void 캐시_금지() throws Exception {
        Long id = saveDoc(openWindow());

        mockMvc.perform(get("/api/meetings/" + id + "/pages/1").with(as(member)))
                .andExpect(header().string("Cache-Control",
                        org.hamcrest.Matchers.containsString("no-store")))
                .andExpect(header().string("Content-Disposition", "inline"));
    }

    @Test
    @DisplayName("★ 워터마크가 실제로 그려진다 — 원본과 픽셀이 달라진다")
    void 워터마크가_박힌다() throws Exception {
        Long id = saveDoc(openWindow());

        byte[] body = mockMvc.perform(get("/api/meetings/" + id + "/pages/1").with(as(member)))
                .andReturn().getResponse().getContentAsByteArray();

        BufferedImage painted = ImageIO.read(new ByteArrayInputStream(body));
        assertThat(nonWhitePixels(painted))
                .as("원본은 흰 이미지였다 — 흰색이 아닌 픽셀이 있으면 무언가 그려진 것이다")
                .isPositive();
    }

    @Test
    @DisplayName("⚠️ 한글을 그릴 수 있는 환경이다 — 못 그리면 워터마크가 □□□가 된다")
    void 한글_렌더링() {
        // 이 테스트가 CI/컨테이너에서 실패하면 배포 환경에 한글 폰트가 없다는 뜻이다.
        // 그 상태로 나가면 예외 없이 조용히 추적 수단이 무력화된다
        // (Dockerfile에 font-noto-cjk를 넣어둔 이유).
        assertThat(watermarkPainter.isKoreanRenderable())
                .as("한글 폰트가 없다 — Dockerfile의 font-noto-cjk 확인")
                .isTrue();
    }

    @Test
    @DisplayName("★ 기간이 지나면 회원은 403 — 404가 아니다 (존재는 이미 목록에 있다)")
    void 기간_밖_회원() throws Exception {
        Long id = saveDoc(closedWindow());

        mockMvc.perform(get("/api/meetings/" + id + "/pages/1").with(as(member)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("★ 기간이 지나도 임원은 볼 수 있다")
    void 기간_밖_임원() throws Exception {
        Long id = saveDoc(closedWindow());

        mockMvc.perform(get("/api/meetings/" + id + "/pages/1").with(as(leader)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("비로그인은 401")
    void 비로그인() throws Exception {
        Long id = saveDoc(openWindow());

        mockMvc.perform(get("/api/meetings/" + id + "/pages/1"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("없는 페이지는 404")
    void 없는_페이지() throws Exception {
        Long id = saveDoc(openWindow());

        mockMvc.perform(get("/api/meetings/" + id + "/pages/99").with(as(member)))
                .andExpect(status().isNotFound());
    }

    // ── §7.7 열람 기록 ───────────────────────────────────────

    @Test
    @DisplayName("★ 열람이 기록된다 — 유출 시 대조할 유일한 근거다")
    void 열람_기록() throws Exception {
        Long id = saveDoc(openWindow());

        mockMvc.perform(get("/api/meetings/" + id + "/pages/1").with(as(member)))
                .andExpect(status().isOk());

        assertThat(viewRepository.findAll()).singleElement().satisfies(view -> {
            assertThat(view.getMember().getId()).isEqualTo(member.getId());
            assertThat(view.getPageNo()).isEqualTo(1);
        });
    }

    @Test
    @DisplayName("★ 같은 페이지를 다시 열어도 행이 늘지 않는다 — 기록이 수만 건이 되면 못 읽는다")
    void 중복_열람() throws Exception {
        Long id = saveDoc(openWindow());

        for (int i = 0; i < 3; i++) {
            mockMvc.perform(get("/api/meetings/" + id + "/pages/1").with(as(member)))
                    .andExpect(status().isOk());
        }

        assertThat(viewRepository.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("다른 페이지는 따로 기록된다 — 어디까지 봤는지가 §7.7의 값이다")
    void 페이지별_기록() throws Exception {
        Long id = saveDoc(openWindow(), 3);

        for (int pageNo = 1; pageNo <= 3; pageNo++) {
            mockMvc.perform(get("/api/meetings/" + id + "/pages/" + pageNo).with(as(member)))
                    .andExpect(status().isOk());
        }

        assertThat(viewRepository.count()).isEqualTo(3);
    }

    @Test
    @DisplayName("§7.7 — 사람 단위로 접어서 보여준다 (한 사람이 10번 나오지 않는다)")
    void 열람_기록_조회() throws Exception {
        Long id = saveDoc(openWindow(), 3);
        for (int pageNo = 1; pageNo <= 3; pageNo++) {
            mockMvc.perform(get("/api/meetings/" + id + "/pages/" + pageNo).with(as(member)));
        }

        mockMvc.perform(get("/api/meetings/" + id + "/views").with(as(leader)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalViewers").value(1))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].memberName").value("김도연"))
                .andExpect(jsonPath("$.data.items[0].maxPageNo").value(3));
    }

    @Test
    @DisplayName("⚠️ 열람 기록은 임원 전용이다 — 누가 뭘 봤는지는 회원이 알 일이 아니다")
    void 열람_기록_인가() throws Exception {
        Long id = saveDoc(openWindow());

        mockMvc.perform(get("/api/meetings/" + id + "/views").with(as(member)))
                .andExpect(status().isForbidden());
    }

    // ── 보조 ─────────────────────────────────────────────────

    private record Window(Instant from, Instant until) {
    }

    private static Window openWindow() {
        return new Window(Instant.now().minus(1, ChronoUnit.HOURS),
                Instant.now().plus(2, ChronoUnit.DAYS));
    }

    private static Window closedWindow() {
        return new Window(Instant.now().minus(5, ChronoUnit.DAYS),
                Instant.now().minus(1, ChronoUnit.DAYS));
    }

    private Long saveDoc(Window window) {
        return saveDoc(window, 1);
    }

    private Long saveDoc(Window window, int pageCount) {
        MeetingDoc doc = meetingDocRepository.saveAndFlush(MeetingDoc.builder()
                .title("2026년 8월 월례회")
                .meetingDate(LocalDate.of(2026, 8, 24))
                .viewableFrom(window.from())
                .viewableUntil(window.until())
                .pageCount(pageCount)
                .build());

        for (int pageNo = 1; pageNo <= pageCount; pageNo++) {
            pageRepository.saveAndFlush(MeetingDocPage.builder()
                    .doc(doc)
                    .pageNo(pageNo)
                    .r2Key("meetings/%d/%d.jpg".formatted(doc.getId(), pageNo))
                    .sizeBytes(1000)
                    .build());
        }
        return doc.getId();
    }

    /** 흰 배경 JPEG — 워터마크가 그려졌는지 픽셀로 확인하기 위해 */
    private static byte[] blankJpeg() throws Exception {
        BufferedImage image = new BufferedImage(800, 1131, BufferedImage.TYPE_INT_RGB);
        var g = image.createGraphics();
        g.setColor(java.awt.Color.WHITE);
        g.fillRect(0, 0, image.getWidth(), image.getHeight());
        g.dispose();

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            ImageIO.write(image, "jpeg", out);
            return out.toByteArray();
        }
    }

    private static long nonWhitePixels(BufferedImage image) {
        long count = 0;
        for (int y = 0; y < image.getHeight(); y += 3) {
            for (int x = 0; x < image.getWidth(); x += 3) {
                int rgb = image.getRGB(x, y) & 0xFFFFFF;
                // JPEG 압축으로 흰색이 정확히 0xFFFFFF가 아닐 수 있어 여유를 둔다
                if (((rgb >> 16) & 0xFF) < 200) {
                    count++;
                }
            }
        }
        return count;
    }

    private RequestPostProcessor as(Member actor) {
        AuthPrincipal principal = new AuthPrincipal(actor.getId(), actor.getRole());
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities());
        return authentication(authentication);
    }
}
