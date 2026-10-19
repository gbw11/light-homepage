package kr.light.push;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.firebase.FirebaseApp;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.security.KeyPairGenerator;
import java.util.Base64;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatNoException;

/**
 * 키를 넣은 서버가 실제로 켜지는가.
 *
 * <p>다른 테스트는 키 없이(NoopPushSender) 돈다 — 그래서 FcmPushSender를 만드는 길은
 * 한 번도 지나지 않았고, firebase-admin이 쓰는 JacksonFactory가 classpath에서 빠진 것을
 * 실제 키로 켜 보고서야 알았다 (2026-10-19, build.gradle 주석). 가짜 키를 만들어 그 길을
 * 지난다 — FirebaseApp · FirebaseMessaging을 만드는 데는 네트워크가 필요 없다.
 */
class FcmPushSenderTest {

    @AfterEach
    void cleanUp() {
        FirebaseApp.getApps().forEach(FirebaseApp::delete);
    }

    @Test
    @DisplayName("★ 서비스 계정 키 JSON으로 발송기를 만든다 — 필요한 라이브러리가 다 있다")
    void 키로_만든다() throws Exception {
        assertThatNoException().isThrownBy(() -> new FcmPushSender(fakeServiceAccount()));
    }

    @Test
    @DisplayName("깨진 키는 이유를 말하고 실패한다 — 키 내용은 메시지에 싣지 않는다")
    void 깨진_키() {
        assertThatThrownBy(() -> new FcmPushSender("{\"type\": \"service_account\", 비밀"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("FIREBASE_SERVICE_ACCOUNT")
                .hasMessageNotContaining("비밀");
    }

    @Test
    @DisplayName("★ 키가 깨져도 서버는 켜진다 — 알림만 건너뛴다 (Render 설정 실수로 사이트가 내려가면 안 된다)")
    void 깨진_키면_알림만_건너뛴다() {
        assertThat(new PushConfig().pushSender("{깨진 키")).isInstanceOf(NoopPushSender.class);
    }

    @Test
    @DisplayName("키가 멀쩡하면 FCM으로 보낸다")
    void 키가_있으면_FCM() throws Exception {
        assertThat(new PushConfig().pushSender(fakeServiceAccount())).isInstanceOf(FcmPushSender.class);
    }

    /** 진짜 키와 같은 모양 — RSA 키는 매번 새로 만든다 (저장소에 키 모양 문자열을 두지 않는다) */
    private static String fakeServiceAccount() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        String pem = "-----BEGIN PRIVATE KEY-----\n"
                + Base64.getMimeEncoder(64, "\n".getBytes()).encodeToString(
                        generator.generateKeyPair().getPrivate().getEncoded())
                + "\n-----END PRIVATE KEY-----\n";
        return new ObjectMapper().writeValueAsString(Map.of(
                "type", "service_account",
                "project_id", "light-test",
                "private_key_id", "test",
                "private_key", pem,
                "client_email", "push-test@light-test.iam.gserviceaccount.com",
                "client_id", "1",
                "token_uri", "https://oauth2.googleapis.com/token"));
    }
}
