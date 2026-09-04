package kr.light.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 저장 용량 가드 설정 — {@code app.storage.*} (SPEC_API.md §8.5 · COST_GUARDRAILS.md §3.6).
 *
 * <p>⚠️ <b>비용 $0이 이 프로젝트의 제약이다.</b> 2026-09-03에 R2에 결제 수단을
 * 등록해서, "카드가 없으니 과금이 불가능하다"는 1차 방어가 사라졌다. 남은 것은
 * 이 값들과 그것을 지키는 코드뿐이다.
 *
 * @param limitBytes    무료 한도. R2 Standard는 10GB다
 * @param warnPercent   경고 시작 지점 (§8.5 {@code warningThreshold})
 * @param blockPercent  업로드 차단 지점 (§8.5 {@code blockThreshold}).
 *                      ⚠️ 100이 아니라 95다 — 한도에 닿은 뒤 막으면 이미 과금이
 *                      시작된 상태이고, 마지막 한 장이 한도를 넘길 수도 있다
 * @param averagePhotoBytes {@code estimatedRemainingPhotos} 계산의 대체값.
 *                      사진이 하나도 없어 실측 평균을 낼 수 없을 때만 쓴다
 */
@ConfigurationProperties(prefix = "app.storage")
public record StorageProperties(
        long limitBytes,
        int warnPercent,
        int blockPercent,
        long averagePhotoBytes
) {

    public StorageProperties {
        if (limitBytes <= 0) {
            throw new IllegalArgumentException("app.storage.limit-bytes는 양수여야 한다: " + limitBytes);
        }
        // ⚠️ 경고가 차단보다 늦으면 경고는 아무 의미가 없다. 설정 실수를
        //    기동 시점에 잡는다 — 운영에서 조용히 어긋나 있으면 알 방법이 없다.
        if (warnPercent <= 0 || blockPercent <= 0
                || warnPercent > 100 || blockPercent > 100
                || warnPercent >= blockPercent) {
            throw new IllegalArgumentException(
                    "app.storage 임계값이 잘못됐다 (0 < warn < block <= 100): warn=%d block=%d"
                            .formatted(warnPercent, blockPercent));
        }
        if (averagePhotoBytes <= 0) {
            throw new IllegalArgumentException(
                    "app.storage.average-photo-bytes는 양수여야 한다: " + averagePhotoBytes);
        }
    }

    /** 업로드를 막기 시작하는 바이트 수 */
    public long blockThresholdBytes() {
        return limitBytes / 100 * blockPercent;
    }
}
