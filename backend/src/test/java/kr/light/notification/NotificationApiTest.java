package kr.light.notification;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import kr.light.auth.AuthPrincipal;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import kr.light.member.Role;
import kr.light.newcomer.NewcomerRepository;
import kr.light.newcomer.NewcomerRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 전도사·임원 알림 (SPEC_API.md §14).
 *
 * <p>이 기능이 존재하는 이유는 <b>§9.1의 알림 메일이 실제로는 아무에게도
 * 가지 않았다</b>는 것이다. 그래서 여기서 지킬 것은 "알림이 뜨는가"보다
 * <b>"놓치지 않는가"</b>다 — 아래 세 테스트가 그 축이다.
 *
 * <ul>
 *   <li>{@link #읽음은_사람별이다} — 한 사람이 눌러 모두의 배지가 사라지지 않는다</li>
 *   <li>{@link #읽는_사이에_들어온_알림은_남는다} — 목록과 읽음 사이의 틈</li>
 *   <li>{@link #표시는_뒤로_가지_않는다} — 읽은 알림이 되살아나지 않는다</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class NotificationApiTest {

    private static final String PATH = "/api/admin/notifications";
    private static final String READ_PATH = PATH + "/read";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired NewcomerRepository newcomerRepository;
    @Autowired NewcomerNotificationReadRepository readRepository;
    @Autowired MemberRepository memberRepository;
    @Autowired JdbcTemplate jdbcTemplate;

    private Member leader;
    private Member pastor;

    @BeforeEach
    void setUp() {
        readRepository.deleteAllInBatch();
        newcomerRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();
        leader = saveMember("임원", "leader", Role.LEADER);
        pastor = saveMember("전도사", "pastor", Role.PASTOR);
    }

    // ── 응답 형태 ────────────────────────────────────────────

    @Test
    @DisplayName("계약이 정한 필드가 그대로 나온다 (§14)")
    void 응답_형태() throws Exception {
        NewcomerRequest saved = saveNewcomer("김도연", "010-1234-5678");

        mockMvc.perform(get(PATH).with(as(leader)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.unreadCount").value(1))
                .andExpect(jsonPath("$.data.hasMore").value(false))
                .andExpect(jsonPath("$.data.readMarker").isString())
                .andExpect(jsonPath("$.data.items[0].type").value("NEWCOMER"))
                .andExpect(jsonPath("$.data.items[0].refId").value(String.valueOf(saved.getId())))
                .andExpect(jsonPath("$.data.items[0].subject").value("김도연"))
                .andExpect(jsonPath("$.data.items[0].createdAt").isString());
    }

    @Test
    @DisplayName("⚠️ 전화번호는 알림에 들어가지 않는다 — 목록(§8.6)에 이미 있다")
    void 전화번호는_나가지_않는다() throws Exception {
        saveNewcomer("김도연", "010-1234-5678");

        String body = mockMvc.perform(get(PATH).with(as(leader)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(body).contains("김도연").doesNotContain("010-1234-5678");
    }

    @Test
    @DisplayName("알림이 없으면 0건이다 — readMarker는 null, 404가 아니다")
    void 빈_목록() throws Exception {
        mockMvc.perform(get(PATH).with(as(leader)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.unreadCount").value(0))
                .andExpect(jsonPath("$.data.items").isEmpty())
                .andExpect(jsonPath("$.data.readMarker").value(nullValue()));
    }

    @Test
    @DisplayName("최근이 위다 — 방금 온 사람부터 연락한다")
    void 정렬() throws Exception {
        backdate(saveNewcomer("먼저온사람", "010-1111-1111"), daysAgo(3));
        saveNewcomer("나중온사람", "010-2222-2222");

        mockMvc.perform(get(PATH).with(as(leader)))
                .andExpect(jsonPath("$.data.items[0].subject").value("나중온사람"))
                .andExpect(jsonPath("$.data.items[1].subject").value("먼저온사람"));
    }

    // ── ★ 개수와 목록은 다른 값이다 ──────────────────────────

    @Test
    @DisplayName("★ 목록은 20건에서 잘리지만 unreadCount는 실제 수다")
    void 목록은_잘리고_개수는_안_잘린다() throws Exception {
        // 목록 길이로 배지를 만들면 21건부터 계속 "20"이 된다
        for (int i = 0; i < 25; i++) {
            saveNewcomer("신청자%02d".formatted(i), "010-0000-00%02d".formatted(i));
        }

        mockMvc.perform(get(PATH).with(as(leader)))
                .andExpect(jsonPath("$.data.unreadCount").value(25))
                .andExpect(jsonPath("$.data.items.length()").value(20))
                .andExpect(jsonPath("$.data.hasMore").value(true));
    }

    // ── 읽음 처리 ────────────────────────────────────────────

    @Test
    @DisplayName("읽음을 누르면 배지가 0이 된다")
    void 읽음_처리() throws Exception {
        saveNewcomer("김도연", "010-1234-5678");

        mockMvc.perform(post(READ_PATH).with(as(leader))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(untilBody(Instant.now())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.readUntil").isString())
                .andExpect(jsonPath("$.data.unreadCount").value(0));

        mockMvc.perform(get(PATH).with(as(leader)))
                .andExpect(jsonPath("$.data.unreadCount").value(0))
                .andExpect(jsonPath("$.data.items").isEmpty());
    }

    @Test
    @DisplayName("본문 없이 보내도 된다 — 「모두 읽음」 버튼 하나로 끝낼 수 있어야 한다")
    void 본문_없는_읽음() throws Exception {
        saveNewcomer("김도연", "010-1234-5678");

        // ⚠️ consumes를 걸면 이 요청이 415가 된다. Content-Type조차 없다
        mockMvc.perform(post(READ_PATH).with(as(leader)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.unreadCount").value(0));
    }

    @Test
    @DisplayName("두 번 눌러도 안전하다")
    void 멱등() throws Exception {
        saveNewcomer("김도연", "010-1234-5678");

        mockMvc.perform(post(READ_PATH).with(as(leader))).andExpect(status().isOk());
        mockMvc.perform(post(READ_PATH).with(as(leader)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.unreadCount").value(0));

        assertThat(readRepository.count()).isEqualTo(1);
    }

    // ── ★ 놓치지 않기 ───────────────────────────────────────

    @Test
    @DisplayName("★ 읽음은 사람별이다 — 임원이 눌러도 전도사의 배지는 남는다")
    void 읽음은_사람별이다() throws Exception {
        // 팀 공유로 두면 한 사람이 열어본 것만으로 모두의 알림이 사라진다.
        // 열어본 것과 실제로 연락한 것은 다르다
        saveNewcomer("김도연", "010-1234-5678");

        mockMvc.perform(post(READ_PATH).with(as(leader))).andExpect(status().isOk());

        mockMvc.perform(get(PATH).with(as(leader)))
                .andExpect(jsonPath("$.data.unreadCount").value(0));
        mockMvc.perform(get(PATH).with(as(pastor)))
                .andExpect(jsonPath("$.data.unreadCount").value(1));
    }

    @Test
    @DisplayName("★ readMarker를 되돌려주면 읽는 사이에 들어온 알림은 남는다")
    void 읽는_사이에_들어온_알림은_남는다() throws Exception {
        backdate(saveNewcomer("먼저온사람", "010-1111-1111"), daysAgo(1));

        // 1) 목록을 본다 — 이 시점의 표시를 받아둔다
        String marker = markerOf(mockMvc.perform(get(PATH).with(as(leader)))
                .andExpect(jsonPath("$.data.unreadCount").value(1))
                .andReturn().getResponse().getContentAsString());

        // 2) 읽음을 누르기 전에 새 신청이 들어온다
        saveNewcomer("방금온사람", "010-2222-2222");

        // 3) 화면에 보였던 것까지만 읽음으로 표시한다
        mockMvc.perform(post(READ_PATH).with(as(leader))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(untilBody(Instant.parse(marker))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.unreadCount").value(1));

        // 아무도 못 본 신청이 조용히 사라지지 않았다
        mockMvc.perform(get(PATH).with(as(leader)))
                .andExpect(jsonPath("$.data.unreadCount").value(1))
                .andExpect(jsonPath("$.data.items[0].subject").value("방금온사람"));
    }

    @Test
    @DisplayName("★ 표시는 뒤로 가지 않는다 — 읽은 알림이 되살아나지 않는다")
    void 표시는_뒤로_가지_않는다() throws Exception {
        // 탭이 두 개 열려 있으면 오래된 표시가 나중에 도착할 수 있다.
        // 그대로 쓰면 배지가 오르락내리락한다
        saveNewcomer("김도연", "010-1234-5678");

        mockMvc.perform(post(READ_PATH).with(as(leader))).andExpect(status().isOk());

        mockMvc.perform(post(READ_PATH).with(as(leader))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(untilBody(daysAgo(30))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.unreadCount").value(0));

        mockMvc.perform(get(PATH).with(as(leader)))
                .andExpect(jsonPath("$.data.unreadCount").value(0));
    }

    @Test
    @DisplayName("★ 미래 시각을 보내면 서버 시각으로 자른다")
    void 미래_시각은_잘린다() throws Exception {
        // 클라이언트 시계가 앞서 있으면 아직 오지 않은 알림까지 읽음이 된다
        mockMvc.perform(post(READ_PATH).with(as(leader))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(untilBody(Instant.now().plus(365, ChronoUnit.DAYS))))
                .andExpect(status().isOk());

        saveNewcomer("나중에온사람", "010-3333-3333");

        mockMvc.perform(get(PATH).with(as(leader)))
                .andExpect(jsonPath("$.data.unreadCount").value(1));
    }

    // ── 보유기간 연동 ───────────────────────────────────────

    @Test
    @DisplayName("★ 원본이 지워지면 알림도 사라진다 — 따로 지울 것이 없다 (§8.6)")
    void 원본과_함께_사라진다() throws Exception {
        NewcomerRequest saved = saveNewcomer("보유기간만료", "010-4444-4444");

        mockMvc.perform(get(PATH).with(as(leader)))
                .andExpect(jsonPath("$.data.unreadCount").value(1));

        // 알림 내용을 복사해뒀다면 여기서 유령 알림이 남는다
        newcomerRepository.deleteById(saved.getId());

        mockMvc.perform(get(PATH).with(as(leader)))
                .andExpect(jsonPath("$.data.unreadCount").value(0));
    }

    @Test
    @DisplayName("계정을 지우면 읽음 표시도 함께 지워진다")
    void 계정_삭제시_표시도_삭제된다() throws Exception {
        mockMvc.perform(post(READ_PATH).with(as(leader))).andExpect(status().isOk());
        assertThat(readRepository.count()).isEqualTo(1);

        memberRepository.deleteById(leader.getId());
        memberRepository.flush();

        assertThat(readRepository.count()).isZero();
    }

    // ── 보조 ─────────────────────────────────────────────────

    private String markerOf(String responseBody) throws Exception {
        JsonNode marker = objectMapper.readTree(responseBody).path("data").path("readMarker");
        assertThat(marker.isTextual()).as("readMarker가 있어야 한다").isTrue();
        return marker.asText();
    }

    private String untilBody(Instant until) throws Exception {
        return objectMapper.writeValueAsString(new NotificationReadRequest(until));
    }

    private static Instant daysAgo(int days) {
        return Instant.now().minus(days, ChronoUnit.DAYS);
    }

    private Member saveMember(String name, String loginId, Role role) {
        return memberRepository.saveAndFlush(Member.builder()
                .name(name).loginId(loginId).role(role).build());
    }

    private NewcomerRequest saveNewcomer(String name, String phone) {
        return newcomerRepository.saveAndFlush(NewcomerRequest.builder()
                .name(name).phone(phone).agreedAt(Instant.now()).build());
    }

    /** ⚠️ {@code created_at}은 {@code updatable = false}라 엔티티로는 못 바꾼다 */
    private void backdate(NewcomerRequest request, Instant createdAt) {
        jdbcTemplate.update("UPDATE newcomer_requests SET created_at = ? WHERE id = ?",
                Timestamp.from(createdAt), request.getId());
    }

    private RequestPostProcessor as(Member actor) {
        AuthPrincipal principal = new AuthPrincipal(actor.getId(), actor.getRole());
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.authorities());
        return authentication(authentication);
    }
}
