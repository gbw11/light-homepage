package kr.light.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Cloudflare R2 접속 설정 — {@code app.r2.*} (ARCHITECTURE.md §4.4).
 *
 * <p>사진·주보·첨부·월례회 문서의 <b>파일 본체</b>가 여기 들어간다. DB에는
 * "그 파일이 R2 어디에 있는지"의 키만 둔다.
 *
 * <h2>⚠️ 키를 저장소에 커밋하지 않는다</h2>
 * {@code accessKeyId}·{@code secretAccessKey}는 <b>{@code application-local.yml}</b>
 * (gitignore) 또는 운영 환경변수로만 준다. 카카오·유튜브 키와 같은 규칙이다.
 *
 * <h2>⚠️ 버킷은 완전 비공개다</h2>
 * 브라우저가 R2를 직접 부르지만, 접근은 전부 <b>우리 서버가 서명한 10분짜리
 * presigned URL</b>로만 이뤄진다 (§4.4). 그래서 이 키는 서버 밖으로 나가지
 * 않는다 — 나가면 버킷 전체가 열린다.
 *
 * @param accountId       Cloudflare 계정 ID(32자리 16진수). 엔드포인트 주소를
 *                        여기서 조립한다 — 비밀은 아니지만 굳이 공개할 값도 아니다
 * @param bucket          버킷 이름
 * @param accessKeyId     R2 <b>Account</b> API 토큰의 Access Key ID.
 *                        ⚠️ User 토큰이 아니다 — User 토큰은 만든 사람이 계정에서
 *                        빠지면 죽어서, 배포된 뒤 예고 없이 사진첩이 안 열린다
 * @param secretAccessKey 같은 토큰의 Secret Access Key. 발급 직후 한 번만 보인다
 */
@ConfigurationProperties(prefix = "app.r2")
public record R2Properties(
        String accountId,
        String bucket,
        String accessKeyId,
        String secretAccessKey
) {

    /**
     * 넷 다 있어야 R2를 부른다.
     *
     * <p>개발 중에는 비어 있는 것이 정상이다 — 키가 없다고 기동을 막으면
     * R2와 무관한 기능도 손댈 수 없다. 대신 R2를 실제로 부르는 자리에서
     * 이걸 확인하고, 설정이 없으면 그 기능만 막는다.
     */
    public boolean isConfigured() {
        return notBlank(accountId) && notBlank(bucket)
                && notBlank(accessKeyId) && notBlank(secretAccessKey);
    }

    /**
     * S3 호환 엔드포인트 — {@code https://<계정ID>.r2.cloudflarestorage.com}.
     *
     * <p>계정 ID에서 조립한다. 따로 설정하게 두면 오타가 나거나, EU/US 같은
     * 관할(jurisdiction) 주소를 잘못 적어 <b>붙긴 붙는데 버킷을 못 찾는</b>
     * 상태가 된다.
     */
    public String endpoint() {
        if (!notBlank(accountId)) {
            throw new IllegalStateException("app.r2.account-id가 없다 — 엔드포인트를 만들 수 없다");
        }
        return "https://%s.r2.cloudflarestorage.com".formatted(accountId);
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }
}
