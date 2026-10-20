package kr.light.push;

import kr.light.member.Role;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executor;

/**
 * 무엇을 누구에게 보낼지 정한다 (SPEC_API.md §15.3).
 *
 * <table>
 *   <tr><th>일</th><th>받는 사람</th><th>방법</th></tr>
 *   <tr><td>공개 공지 게시</td><td>앱 설치자 전체</td><td>주제 {@code public}</td></tr>
 *   <tr><td>주보 업로드</td><td>앱 설치자 전체</td><td>주제 {@code public}</td></tr>
 *   <tr><td>회원 공지 게시</td><td>로그인한 회원 기기</td><td>기기 토큰</td></tr>
 *   <tr><td>새가족 신청</td><td>전도사 · 임원 기기</td><td>기기 토큰</td></tr>
 * </table>
 *
 * <p><b>⚠️ 알림이 실패해도 원래 일은 성공이다.</b> 커밋이 끝난 뒤({@code AFTER_COMMIT})
 * 별도 스레드({@code pushExecutor})에서 보내고, 예외는 여기서 삼켜 로그만 남긴다.
 * 공지를 올렸는데 FCM이 잠깐 안 된다고 공지가 사라지면 안 된다.
 *
 * <p>회의록 · 예산안은 알림을 보내지 않는다 — 열람 기간이 따로 있어 "올렸다"가
 * "볼 수 있다"가 아니다 (2026-10-19 범위 결정).
 */
@Slf4j
@Component
public class PushNotifier {

    private final PushSender sender;
    private final MemberDeviceRepository deviceRepository;
    private final Executor executor;
    private final TransactionTemplate transaction;

    public PushNotifier(PushSender sender,
                        MemberDeviceRepository deviceRepository,
                        @Qualifier("pushExecutor") Executor executor,
                        PlatformTransactionManager transactionManager) {
        this.sender = sender;
        this.deviceRepository = deviceRepository;
        this.executor = executor;
        // ⚠️ 새 트랜잭션이어야 한다. AFTER_COMMIT 리스너 안(테스트처럼 같은 스레드)에서
        //    기본값(REQUIRED)을 쓰면 이미 커밋된 트랜잭션에 끼어들어, 죽은 토큰을 지운
        //    것이 저장되지 않는다
        this.transaction = new TransactionTemplate(transactionManager);
        this.transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @TransactionalEventListener
    public void on(PushEvents.PostPublished event) {
        Map<String, String> data = Map.of("type", "notice", "postId", String.valueOf(event.postId()));
        switch (event.category()) {
            case NOTICE_PUBLIC -> run(() -> sender.sendToTopic(PushTopics.PUBLIC,
                    new PushMessage(tagged("공지", event.title()), "새 공지가 올라왔어요.", data)));
            // 회원 공지 제목은 회원에게만 — 주제로 보내면 비회원도 받는다
            case NOTICE_MEMBER -> run(() -> sendToRoles(EnumSet.allOf(Role.class),
                    new PushMessage(tagged("회원 공지", event.title()), "새 회원 공지가 올라왔어요.", data)));
            case MINUTES, BUDGET -> {
                // 위 클래스 주석
            }
        }
    }

    @TransactionalEventListener
    public void on(PushEvents.BulletinUploaded event) {
        String date = "%d월 %d일".formatted(
                event.serviceDate().getMonthValue(), event.serviceDate().getDayOfMonth());
        run(() -> sender.sendToTopic(PushTopics.PUBLIC, new PushMessage(
                tagged("주보", date + " 주보"), "새 주보가 올라왔어요.",
                Map.of("type", "bulletin", "bulletinId", String.valueOf(event.bulletinId())))));
    }

    @TransactionalEventListener
    public void on(PushEvents.NewcomerRegistered event) {
        // 이름 · 연락처는 싣지 않는다 — 잠금 화면에 그대로 보인다. 누구인지는 앱의
        // 새가족 목록에서 본다 (§8.6)
        run(() -> sendToRoles(EnumSet.of(Role.LEADER, Role.PASTOR), new PushMessage(
                tagged("새가족", "새가족 신청"), "새가족 신청이 들어왔어요. 확인해 주세요.",
                Map.of("type", "newcomer"))));
    }

    /**
     * 알림 첫 줄 — 「[공지] 가을 수련회 안내」.
     *
     * <p>안드로이드 알림창은 제목과 내용을 같은 크기 · 같은 굵기로 두 줄에 그린다.
     * 「새 공지 / 가을 수련회 안내」로 보내면 어느 줄이 종류이고 어느 줄이 글
     * 제목인지 구분이 안 된다 (2026-10-20 실기 확인). 그래서 첫 줄에 종류를
     * 대괄호로 붙여 글 제목과 함께 두고, 둘째 줄은 무슨 일인지 한 문장으로 쓴다
     */
    static String tagged(String kind, String title) {
        return "[" + kind + "] " + title;
    }

    /** 이 역할들의 기기로 보내고, FCM이 「없는 기기」라고 답한 토큰은 지운다 */
    private void sendToRoles(EnumSet<Role> roles, PushMessage message) {
        List<String> tokens = transaction.execute(status -> deviceRepository.findTokensByRoles(roles));
        if (tokens == null || tokens.isEmpty()) {
            return;
        }
        List<String> dead = sender.sendToTokens(tokens, message);
        if (!dead.isEmpty()) {
            transaction.executeWithoutResult(status -> deviceRepository.deleteByTokens(dead));
            log.info("없어진 기기 {}대를 지웠다", dead.size());
        }
    }

    /** 커밋 뒤 발송 스레드에서. 실패는 삼킨다 — 원래 일은 이미 성공했다 */
    private void run(Runnable send) {
        executor.execute(() -> {
            try {
                send.run();
            } catch (RuntimeException e) {
                log.warn("푸시 발송 중 오류 — 알림만 빠지고 원래 일은 그대로다", e);
            }
        });
    }
}
