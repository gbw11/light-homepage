package kr.light.storage;

import kr.light.common.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.Delete;
import software.amazon.awssdk.services.s3.model.DeleteObjectsRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.ObjectIdentifier;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.util.Collection;
import java.util.List;

/**
 * Cloudflare R2 접근 (ARCHITECTURE.md §4.4).
 *
 * <p><b>버킷은 완전 비공개다.</b> 브라우저가 R2를 직접 부르지만, 접근은 전부
 * 여기서 서명한 <b>10분짜리 presigned URL</b>로만 이뤄진다. 그래서 키는 서버
 * 밖으로 나가지 않는다 — 나가면 버킷 전체가 열린다.
 *
 * <h2>연산 횟수를 어디서 세는가</h2>
 * ★ <b>presigned URL 발급에서는 세지 않는다.</b> 서명은 이 프로세스 안의 암호
 * 연산이고 R2를 호출하지 않는다 — 과금은 그 URL로 <b>브라우저가 실제 요청을
 * 보낼 때</b> 일어난다. 발급 시점에 세면 쓰이지 않은 URL까지 세어 숫자가 부풀고,
 * 폭주 감지가 늑대소년이 된다.
 *
 * <p>그래서 {@link #put}만 {@link R2OperationClass#A}를 기록한다. 삭제는
 * 무료라 세지 않는다.
 */
@Slf4j
@Component
public class R2Client {

    /**
     * presigned URL 수명.
     *
     * <p>10분이다 (§4.4). 길면 URL이 새어나갔을 때 열려 있는 시간이 길어지고,
     * 짧으면 주보 여러 장을 넘겨보는 중에 만료된다.
     */
    public static final Duration URL_TTL = Duration.ofMinutes(10);

    private final S3Client s3;
    private final S3Presigner presigner;
    private final R2Properties properties;
    private final R2OperationRecorder recorder;

    R2Client(S3Client s3, S3Presigner presigner,
             R2Properties properties, R2OperationRecorder recorder) {
        this.s3 = s3;
        this.presigner = presigner;
        this.properties = properties;
        this.recorder = recorder;
    }

    /**
     * 객체를 올린다 — <b>Class A 1회</b>.
     *
     * <p>⚠️ 스트림으로 넘긴다. {@code getBytes()}로 통째로 읽으면 512MB짜리
     * 무료 인스턴스에서 여러 장이 동시에 올라올 때 힙이 넘친다.
     */
    public void put(String key, InputStream content, long contentLength, String contentType) {
        requireConfigured();
        try {
            s3.putObject(
                    PutObjectRequest.builder()
                            .bucket(properties.bucket())
                            .key(key)
                            .contentType(contentType)
                            .contentLength(contentLength)
                            .build(),
                    RequestBody.fromInputStream(content, contentLength));
        } catch (S3Exception | software.amazon.awssdk.core.exception.SdkClientException e) {
            // ⚠️ 예외 본문을 그대로 싣지 않는다 — 요청에 서명 정보가 들어 있다
            log.error("R2 업로드 실패: key={} ({})", key, e.getClass().getSimpleName());
            throw new IllegalStateException("파일 저장에 실패했습니다.", e);
        }
        recorder.record(R2OperationClass.A);
    }

    /** {@link org.springframework.web.multipart.MultipartFile} 편의 오버로드 */
    public void put(String key, org.springframework.web.multipart.MultipartFile file) {
        try (InputStream in = file.getInputStream()) {
            put(key, in, file.getSize(), file.getContentType());
        } catch (IOException e) {
            throw new IllegalStateException("업로드 파일을 읽지 못했습니다.", e);
        }
    }

    /**
     * 열람용 임시 URL. <b>연산이 아니다</b> — 위 클래스 주석 참고.
     *
     * <p>⚠️ 이 URL 자체에는 인증이 없다. 받은 사람은 만료 전까지 누구에게든
     * 넘길 수 있다 — 그래서 수명이 짧고, 권한 판단은 <b>URL을 발급하기 전에</b>
     * 끝나 있어야 한다.
     */
    public String presignedGetUrl(String key) {
        requireConfigured();
        return presigner.presignGetObject(GetObjectPresignRequest.builder()
                        .signatureDuration(URL_TTL)
                        .getObjectRequest(GetObjectRequest.builder()
                                .bucket(properties.bucket())
                                .key(key)
                                .build())
                        .build())
                .url()
                .toString();
    }

    /**
     * 객체들을 지운다 — <b>무료</b>다 (DeleteObject는 어느 등급도 아니다).
     *
     * <p>⚠️ 지우지 않고 남기면 용량이 조용히 새고, 10GB를 넘는 순간 과금이
     * 시작된다. 삭제가 공짜라는 것은 <b>아까워할 이유가 없다</b>는 뜻이다.
     *
     * <p>실패해도 예외를 밖으로 던지지 않는다. DB 행은 이미 지워졌거나 지워질
     * 참이고, 여기서 롤백하면 사용자는 "삭제가 안 된다"만 겪는다. 대신
     * <b>경고를 남긴다</b> — 남은 객체는 용량 화면(§8.5)과 로그로 드러난다.
     */
    public void deleteAll(Collection<String> keys) {
        if (keys.isEmpty() || !properties.isConfigured()) {
            return;
        }
        List<ObjectIdentifier> targets = keys.stream()
                .map(key -> ObjectIdentifier.builder().key(key).build())
                .toList();
        try {
            s3.deleteObjects(DeleteObjectsRequest.builder()
                    .bucket(properties.bucket())
                    .delete(Delete.builder().objects(targets).build())
                    .build());
        } catch (RuntimeException e) {
            log.error("⚠️ R2 객체 삭제 실패 — 용량이 샌다. keys={} ({})",
                    keys, e.getClass().getSimpleName());
        }
    }

    public boolean isConfigured() {
        return properties.isConfigured();
    }

    private void requireConfigured() {
        if (!properties.isConfigured()) {
            // 개발 중 키가 없는 것은 정상이다. 다만 R2가 필요한 기능은 여기서 멈춘다 —
            // 설정이 없는 채로 "성공"을 돌려주면 파일이 사라진 것을 나중에 안다.
            throw new IllegalStateException("app.r2 설정이 없습니다.");
        }
    }

    /** 설정이 없을 때 R2가 필요한 엔드포인트가 내보낼 응답 */
    public static ApiException notConfigured() {
        return ApiException.storageLimit("파일 저장소가 준비되지 않았습니다.");
    }
}
