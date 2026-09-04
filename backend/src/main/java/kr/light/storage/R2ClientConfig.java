package kr.light.storage;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.net.URI;

/**
 * R2용 S3 클라이언트 (ARCHITECTURE.md §4.4).
 *
 * <p>R2는 S3 호환이라 AWS SDK를 그대로 쓴다. 다만 세 가지를 맞춰야 한다:
 * <ul>
 *   <li><b>엔드포인트</b>를 R2로 돌린다 — 안 하면 AWS로 간다</li>
 *   <li><b>리전은 {@code auto}</b> — R2에는 리전 개념이 없지만 SDK가 서명에
 *       리전 문자열을 요구한다. 다른 값을 넣으면 서명이 맞지 않는다</li>
 *   <li><b>path-style 주소</b> — {@code bucket.endpoint} 형태의 가상 호스트
 *       주소를 쓰면 R2에서 버킷을 찾지 못한다</li>
 * </ul>
 *
 * <p>⚠️ 설정이 비어 있어도 빈은 만든다. 키가 없다고 기동을 막으면 R2와 무관한
 * 기능도 손댈 수 없다 — 실제 호출 직전에 {@link R2Properties#isConfigured()}로
 * 걸러낸다.
 */
@Configuration
class R2ClientConfig {

    /** R2에는 리전이 없지만 SigV4 서명에 문자열이 필요하다 */
    private static final Region SIGNING_REGION = Region.of("auto");

    @Bean
    S3Client r2S3Client(R2Properties properties) {
        return S3Client.builder()
                .endpointOverride(endpointOf(properties))
                .region(SIGNING_REGION)
                .credentialsProvider(credentials(properties))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(true)
                        .build())
                .build();
    }

    @Bean
    S3Presigner r2S3Presigner(R2Properties properties) {
        return S3Presigner.builder()
                .endpointOverride(endpointOf(properties))
                .region(SIGNING_REGION)
                .credentialsProvider(credentials(properties))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(true)
                        .build())
                .build();
    }

    /**
     * 설정이 없으면 <b>형식만 맞는</b> 주소를 준다.
     *
     * <p>빈 생성 시점에 터뜨리지 않기 위해서다. 이 클라이언트로 실제 호출이
     * 일어나는 일은 없다 — {@link R2Client}가 그 전에 막는다.
     */
    private static URI endpointOf(R2Properties properties) {
        return URI.create(properties.isConfigured()
                ? properties.endpoint()
                : "https://unconfigured.r2.cloudflarestorage.com");
    }

    private static StaticCredentialsProvider credentials(R2Properties properties) {
        return StaticCredentialsProvider.create(AwsBasicCredentials.create(
                properties.accessKeyId() == null ? "unconfigured" : properties.accessKeyId(),
                properties.secretAccessKey() == null ? "unconfigured" : properties.secretAccessKey()));
    }
}
