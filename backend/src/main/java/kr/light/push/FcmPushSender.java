package kr.light.push;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.AndroidConfig;
import com.google.firebase.messaging.AndroidNotification;
import com.google.firebase.messaging.BatchResponse;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.MessagingErrorCode;
import com.google.firebase.messaging.MulticastMessage;
import com.google.firebase.messaging.Notification;
import com.google.firebase.messaging.SendResponse;
import lombok.extern.slf4j.Slf4j;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * FCM으로 보낸다 — Firebase Admin SDK의 HTTP v1 (infra/firebase/README.md).
 *
 * <p>키는 환경변수 {@code FIREBASE_SERVICE_ACCOUNT}의 <b>JSON 내용 전체</b>다. 파일
 * 경로가 아니다 — Render는 파일을 올릴 곳이 마땅치 않고, 환경변수 하나로 끝난다.
 * ⚠️ 키 내용은 어디에도 로그로 남기지 않는다.
 */
@Slf4j
public class FcmPushSender implements PushSender {

    /** 앱이 만드는 알림 채널 (SPEC_API.md §15.3) — 안드로이드 8+는 채널이 있어야 뜬다 */
    static final String ANDROID_CHANNEL_ID = "light_notices";

    /** FCM 한 번에 보낼 수 있는 토큰 수 */
    private static final int MULTICAST_LIMIT = 500;

    /** 이 답이 오면 그 토큰은 다시 쓸 수 없다 — 앱 삭제 · 데이터 삭제 · 다른 프로젝트 토큰 */
    private static final Set<MessagingErrorCode> DEAD_TOKEN = Set.of(
            MessagingErrorCode.UNREGISTERED,
            MessagingErrorCode.INVALID_ARGUMENT,
            MessagingErrorCode.SENDER_ID_MISMATCH);

    private final FirebaseMessaging messaging;

    public FcmPushSender(String serviceAccountJson) {
        try {
            GoogleCredentials credentials = GoogleCredentials.fromStream(
                    new ByteArrayInputStream(serviceAccountJson.getBytes(StandardCharsets.UTF_8)));
            // 이름을 붙여 만든다 — 기본 앱([DEFAULT])을 다른 곳이 만들었어도 부딪히지 않게
            FirebaseApp app = FirebaseApp.getApps().stream()
                    .filter(a -> a.getName().equals("light"))
                    .findFirst()
                    .orElseGet(() -> FirebaseApp.initializeApp(
                            FirebaseOptions.builder().setCredentials(credentials).build(), "light"));
            this.messaging = FirebaseMessaging.getInstance(app);
        } catch (IOException e) {
            // 키가 깨졌다 — 내용은 남기지 않는다(비밀). 배포 설정을 고쳐야 하는 문제다
            throw new IllegalStateException("FIREBASE_SERVICE_ACCOUNT를 읽을 수 없다 (JSON 형식 확인)", e);
        }
    }

    @Override
    public void sendToTopic(String topic, PushMessage message) {
        try {
            String id = messaging.send(Message.builder()
                    .setTopic(topic)
                    .setNotification(notification(message))
                    .setAndroidConfig(android())
                    .putAllData(message.data())
                    .build());
            log.info("푸시 발송: topic={} title={} id={}", topic, message.title(), id);
        } catch (FirebaseMessagingException e) {
            log.warn("푸시 실패: topic={} code={}", topic, e.getMessagingErrorCode(), e);
        }
    }

    @Override
    public List<String> sendToTokens(List<String> tokens, PushMessage message) {
        List<String> dead = new ArrayList<>();
        for (int from = 0; from < tokens.size(); from += MULTICAST_LIMIT) {
            List<String> chunk = tokens.subList(from, Math.min(from + MULTICAST_LIMIT, tokens.size()));
            try {
                BatchResponse response = messaging.sendEachForMulticast(MulticastMessage.builder()
                        .addAllTokens(chunk)
                        .setNotification(notification(message))
                        .setAndroidConfig(android())
                        .putAllData(message.data())
                        .build());
                List<SendResponse> results = response.getResponses();
                for (int i = 0; i < results.size(); i++) {
                    FirebaseMessagingException error = results.get(i).getException();
                    if (error != null && DEAD_TOKEN.contains(error.getMessagingErrorCode())) {
                        dead.add(chunk.get(i));
                    }
                }
                log.info("푸시 발송: 기기 {}대 중 {}대 성공 title={}",
                        chunk.size(), response.getSuccessCount(), message.title());
            } catch (FirebaseMessagingException e) {
                log.warn("푸시 실패: 기기 {}대 code={}", chunk.size(), e.getMessagingErrorCode(), e);
            }
        }
        return dead;
    }

    private static Notification notification(PushMessage message) {
        return Notification.builder().setTitle(message.title()).setBody(message.body()).build();
    }

    /** 바로 뜨게(HIGH) · 앱이 만든 채널로 */
    private static AndroidConfig android() {
        return AndroidConfig.builder()
                .setPriority(AndroidConfig.Priority.HIGH)
                .setNotification(AndroidNotification.builder()
                        .setChannelId(ANDROID_CHANNEL_ID)
                        .build())
                .build();
    }
}
