package kr.light.storage;

import kr.light.common.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.Delete;
import software.amazon.awssdk.services.s3.model.DeleteObjectsRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.ObjectIdentifier;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

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
     * <b>내려받기</b>용 임시 URL — 브라우저가 탭에서 열지 않고 저장하게 한다.
     *
     * <p>열람용 URL({@link #presignedGetUrl})과 대상은 같은 객체지만,
     * {@code Content-Disposition: attachment}를 R2가 응답에 붙이도록
     * 지시한다는 점이 다르다. 그 지시가 없으면 브라우저는 이미지를 그냥
     * 화면에 띄운다 — "다운로드" 버튼이 동작하지 않는 것처럼 보인다.
     *
     * <p>파일명도 여기서 정한다. R2 키는 {@code bulletins/12/1.webp}처럼
     * 우리 사정이라, 그대로 저장되면 사용자가 나중에 무슨 파일인지 알 수 없다.
     *
     * @param filename 사용자에게 저장될 이름
     */
    public String presignedDownloadUrl(String key, String filename) {
        requireConfigured();
        return presigner.presignGetObject(GetObjectPresignRequest.builder()
                        .signatureDuration(URL_TTL)
                        .getObjectRequest(GetObjectRequest.builder()
                                .bucket(properties.bucket())
                                .key(key)
                                // ⚠️ 파일명을 그대로 헤더에 넣지 않는다. 한글·공백이
                                //    섞이면 헤더가 깨지고, 따옴표·개행이 들어오면
                                //    헤더를 조작할 수 있다 (RFC 5987 형식으로 인코딩).
                                .responseContentDisposition(
                                        "attachment; filename*=UTF-8''" + encode(filename))
                                .build())
                        .build())
                .url()
                .toString();
    }

    private static String encode(String filename) {
        return java.net.URLEncoder.encode(filename, java.nio.charset.StandardCharsets.UTF_8)
                .replace("+", "%20");
    }

    /**
     * 업로드용 임시 URL (§6.5) — <b>연산이 아니다</b>.
     *
     * <p>브라우저가 이 URL로 R2에 직접 올린다. 파일이 우리 서버를 통과하지
     * 않는다 — 512MB 인스턴스에서 수백 장의 스트림을 받으면 메모리가 터진다
     * (ARCHITECTURE.md §7.3).
     *
     * <p>⚠️ 수명이 {@link #URL_TTL}(10분)이 아니라 15분이다. 200장을 배치로
     * 나눠 올리는 동안 앞쪽 URL이 만료되면 재발급 왕복이 늘어난다.
     *
     * <p>★ 여기서 Class A를 세지 않는다. 실제 {@code PutObject}는 브라우저가
     * 보내므로 우리는 그 시점을 모른다 — {@link #objectSize}가 불리는
     * 커밋(§6.6) 시점에 <b>업로드가 실제로 일어났음을 확인하고</b> 센다.
     */
    public String presignedPutUrl(String key, String contentType, Duration ttl) {
        requireConfigured();
        return presigner.presignPutObject(PutObjectPresignRequest.builder()
                        .signatureDuration(ttl)
                        .putObjectRequest(PutObjectRequest.builder()
                                .bucket(properties.bucket())
                                .key(key)
                                .contentType(contentType)
                                .build())
                        .build())
                .url()
                .toString();
    }

    /**
     * 객체가 실제로 올라왔는지 확인하고 크기를 읽는다 (§6.6) — <b>Class B 1회</b>.
     *
     * <p>⚠️ <b>클라이언트가 말한 크기를 믿지 않는다.</b> 커밋 요청은 브라우저가
     * 보내는데, 업로드가 실패했거나 아예 하지 않았어도 커밋만 부를 수 있다.
     * 그러면 R2에 없는 사진이 목록에 뜨고 용량 집계도 틀어진다.
     *
     * @return 객체가 없으면 비어 있다
     */
    public java.util.Optional<Long> objectSize(String key) {
        requireConfigured();
        try {
            long size = s3.headObject(HeadObjectRequest.builder()
                    .bucket(properties.bucket())
                    .key(key)
                    .build()).contentLength();
            recorder.record(R2OperationClass.B);
            return java.util.Optional.of(size);
        } catch (NoSuchKeyException e) {
            recorder.record(R2OperationClass.B);
            return java.util.Optional.empty();
        } catch (RuntimeException e) {
            log.error("R2 조회 실패: key={} ({})", key, e.getClass().getSimpleName());
            return java.util.Optional.empty();
        }
    }

    /**
     * 객체를 <b>서버가 직접 읽는다</b> — <b>Class B 1회</b>.
     *
     * <p>월례회(§7)만 이 경로를 쓴다. 그 리소스는 <b>presigned URL을 발급하지
     * 않는다</b> — 발급하면 열람 기간이 끝난 뒤에도 URL이 만료 전까지 살아 있고
     * 공유된다. 서버가 읽어 워터마크를 합성한 뒤 스트리밍한다.
     *
     * <p>⚠️ 그래서 이 메서드는 <b>파일을 힙에 올린다.</b> 요청당 이미지 하나가
     * 올라오므로 동시 열람자 수만큼 곱해진다. 512MB에서 페이지 하나(약 550KB
     * JPEG → 압축 해제 시 수 MB)를 다루는 것을 전제로 쓴다.
     */
    public byte[] read(String key) {
        requireConfigured();
        try {
            byte[] bytes = s3.getObjectAsBytes(GetObjectRequest.builder()
                    .bucket(properties.bucket())
                    .key(key)
                    .build()).asByteArray();
            recorder.record(R2OperationClass.B);
            return bytes;
        } catch (NoSuchKeyException e) {
            recorder.record(R2OperationClass.B);
            throw ApiException.notFound();
        } catch (RuntimeException e) {
            log.error("R2 읽기 실패: key={} ({})", key, e.getClass().getSimpleName());
            throw new IllegalStateException("파일을 읽지 못했습니다.", e);
        }
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
