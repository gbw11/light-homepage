package kr.light.push;

import com.fasterxml.jackson.databind.ObjectMapper;
import kr.light.attachment.AttachmentRepository;
import kr.light.auth.AuthPrincipal;
import kr.light.bulletin.BulletinRepository;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import kr.light.member.Role;
import kr.light.newcomer.NewcomerRepository;
import kr.light.post.PostRepository;
import kr.light.storage.R2Client;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 무엇을 누구에게 보내나 (SPEC_API.md §15.3). FCM은 부르지 않는다 — {@link PushSender}를
 * 가로채 보낸 것을 본다. 테스트 프로필은 같은 스레드에서 보낸다(app.push.async=false).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PushNotificationApiTest {

    /** 새가족 접수는 IP마다 5분 5회라, 테스트마다 다른 IP로 보낸다 */
    private static final AtomicInteger IP = new AtomicInteger(1);

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired MemberRepository memberRepository;
    @Autowired MemberDeviceRepository deviceRepository;
    @Autowired PostRepository postRepository;
    @Autowired AttachmentRepository attachmentRepository;
    @Autowired BulletinRepository bulletinRepository;
    @Autowired NewcomerRepository newcomerRepository;

    @MockitoBean PushSender sender;
    @MockitoBean R2Client r2Client;

    Member member;
    Member leader;
    Member pastor;

    @BeforeEach
    void setUp() {
        attachmentRepository.deleteAllInBatch();
        bulletinRepository.deleteAllInBatch();
        postRepository.deleteAllInBatch();
        newcomerRepository.deleteAllInBatch();
        deviceRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();

        member = save("회원", "member", Role.MEMBER);
        leader = save("임원", "leader", Role.LEADER);
        pastor = save("전도사", "pastor", Role.PASTOR);
        device(member, "token-member");
        device(leader, "token-leader");
        device(pastor, "token-pastor");

        given(sender.sendToTokens(anyList(), any())).willReturn(List.of());
    }

    // ── 공지 ─────────────────────────────────────────────────

    @Test
    @DisplayName("공개 공지를 게시하면 주제 public으로 「새 공지」 — 제목 · postId")
    void 공개_공지() throws Exception {
        String id = write("NOTICE_PUBLIC", "가을 수련회 안내", true);

        ArgumentCaptor<PushMessage> message = ArgumentCaptor.forClass(PushMessage.class);
        verify(sender).sendToTopic(eq(PushTopics.PUBLIC), message.capture());
        assertThat(message.getValue().title()).isEqualTo("새 공지");
        assertThat(message.getValue().body()).isEqualTo("가을 수련회 안내");
        assertThat(message.getValue().data()).containsEntry("type", "notice").containsEntry("postId", id);
        verify(sender, never()).sendToTokens(anyList(), any());
    }

    @Test
    @DisplayName("★ 회원 공지는 주제가 아니라 로그인한 기기 토큰으로만 — 비회원에게 새지 않는다")
    void 회원_공지() throws Exception {
        write("NOTICE_MEMBER", "마을장 모임", true);

        ArgumentCaptor<List<String>> tokens = tokensCaptor();
        ArgumentCaptor<PushMessage> message = ArgumentCaptor.forClass(PushMessage.class);
        verify(sender).sendToTokens(tokens.capture(), message.capture());
        assertThat(tokens.getValue()).containsExactlyInAnyOrder("token-member", "token-leader", "token-pastor");
        assertThat(message.getValue().title()).isEqualTo("새 회원 공지");
        verify(sender, never()).sendToTopic(anyString(), any());
    }

    @Test
    @DisplayName("임시저장은 보내지 않고, 처음 게시할 때 한 번 — 다시 저장해도 또 가지 않는다")
    void 처음_게시할_때_한_번() throws Exception {
        String id = write("NOTICE_PUBLIC", "초안", false);
        verifyNoInteractions(sender);

        edit(id, "NOTICE_PUBLIC", "초안", true);
        verify(sender).sendToTopic(eq(PushTopics.PUBLIC), any());

        edit(id, "NOTICE_PUBLIC", "초안 — 오타 수정", true);
        verify(sender).sendToTopic(eq(PushTopics.PUBLIC), any()); // 여전히 한 번
    }

    @Test
    @DisplayName("회의록 · 예산안은 알림을 보내지 않는다 (열람 기간이 따로 있다)")
    void 회의록_예산안() throws Exception {
        write("MINUTES", "9월 회의록", true);
        write("BUDGET", "하반기 예산", true);

        verifyNoInteractions(sender);
    }

    // ── 주보 · 새가족 ────────────────────────────────────────

    @Test
    @DisplayName("주보를 올리면 주제 public으로 「10월 19일 주보가 올라왔어요.」")
    void 주보() throws Exception {
        String body = mockMvc.perform(multipart("/api/bulletins")
                        .file(new MockMultipartFile("pages", "1.webp", "image/webp", "page".getBytes()))
                        .param("serviceDate", "2026-10-19")
                        .with(as(leader)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String id = objectMapper.readTree(body).path("data").path("id").asText();

        ArgumentCaptor<PushMessage> message = ArgumentCaptor.forClass(PushMessage.class);
        verify(sender).sendToTopic(eq(PushTopics.PUBLIC), message.capture());
        assertThat(message.getValue().body()).isEqualTo("10월 19일 주보가 올라왔어요.");
        assertThat(message.getValue().data()).containsEntry("type", "bulletin").containsEntry("bulletinId", id);
    }

    @Test
    @DisplayName("★ 새가족 신청은 전도사 · 임원 기기에만 — 이름 · 연락처는 싣지 않는다 (잠금 화면)")
    void 새가족() throws Exception {
        newcomer("홍길동", "010-1111-2222");

        ArgumentCaptor<List<String>> tokens = tokensCaptor();
        ArgumentCaptor<PushMessage> message = ArgumentCaptor.forClass(PushMessage.class);
        verify(sender).sendToTokens(tokens.capture(), message.capture());
        assertThat(tokens.getValue()).containsExactlyInAnyOrder("token-leader", "token-pastor");
        PushMessage sent = message.getValue();
        assertThat(sent.title() + sent.body() + sent.data()).doesNotContain("홍길동", "1111", "2222");
        assertThat(sent.data()).containsEntry("type", "newcomer");
    }

    // ── 실패 · 정리 ──────────────────────────────────────────

    @Test
    @DisplayName("FCM이 「없는 기기」라고 답한 토큰은 지운다")
    void 죽은_토큰() throws Exception {
        given(sender.sendToTokens(anyList(), any())).willReturn(List.of("token-leader"));

        newcomer("새가족", "010-0000-0000");

        assertThat(deviceRepository.findByToken("token-leader")).isEmpty();
        assertThat(deviceRepository.findByToken("token-pastor")).isPresent();
    }

    @Test
    @DisplayName("★ 알림이 실패해도 공지 등록은 성공한다")
    void 알림_실패() throws Exception {
        willThrow(new RuntimeException("FCM 장애")).given(sender).sendToTopic(anyString(), any());

        write("NOTICE_PUBLIC", "그래도 올라가야 하는 공지", true);

        assertThat(postRepository.count()).isEqualTo(1);
    }

    // ── 보조 ─────────────────────────────────────────────────

    private String write(String category, String title, boolean publish) throws Exception {
        String body = mockMvc.perform(post("/api/posts").with(as(leader))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(form(category, title, publish))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).path("data").path("id").asText();
    }

    private void edit(String id, String category, String title, boolean publish) throws Exception {
        mockMvc.perform(put("/api/posts/" + id).with(as(leader))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(form(category, title, publish))))
                .andExpect(status().isNoContent());
    }

    private Map<String, Object> form(String category, String title, boolean publish) {
        Map<String, Object> body = new HashMap<>();
        body.put("category", category);
        body.put("title", title);
        body.put("body", Map.of("type", "doc", "content", List.of()));
        body.put("pinned", false);
        body.put("publish", publish);
        if (category.equals("MINUTES") || category.equals("BUDGET")) {
            body.put("viewableFrom", Instant.now().minusSeconds(86_400).toString());
            body.put("viewableUntil", Instant.now().plusSeconds(86_400).toString());
        }
        return body;
    }

    private void newcomer(String name, String phone) throws Exception {
        mockMvc.perform(post("/api/newcomers")
                        .header("X-Forwarded-For", "10.20.0." + IP.getAndIncrement())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", name, "phone", phone, "birthDate", "2001-03-14",
                                "agreed", true, "honeypot", ""))))
                .andExpect(status().isCreated());
    }

    private Member save(String name, String loginId, Role role) {
        return memberRepository.saveAndFlush(Member.builder()
                .name(name).loginId(loginId).role(role).build());
    }

    private void device(Member owner, String token) {
        deviceRepository.saveAndFlush(MemberDevice.builder()
                .member(owner).token(token).platform(DevicePlatform.ANDROID)
                .updatedAt(Instant.now()).build());
    }

    @SuppressWarnings("unchecked")
    private static ArgumentCaptor<List<String>> tokensCaptor() {
        return ArgumentCaptor.forClass(List.class);
    }

    private static RequestPostProcessor as(Member who) {
        AuthPrincipal principal = new AuthPrincipal(who.getId(), who.getRole());
        return authentication(new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities()));
    }
}
