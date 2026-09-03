package kr.light.storage;

import kr.light.common.ApiException;
import kr.light.photo.PhotoRepository;
import kr.light.photo.PhotoStatus;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 저장 용량 가드 (SPEC_API.md §8.5 · ARCHITECTURE.md §4.3).
 *
 * <p><b>⚠️ 이것이 지금 유일하게 실질적인 과금 방어다.</b> 2026-09-03에 R2에
 * 결제 수단을 등록하면서 "카드가 없으니 과금이 불가능하다"는 1차 방어가
 * 사라졌다. 한도를 넘기면 중단이 아니라 실제 청구($0.015/GB·월)가 된다.
 *
 * <p>⚠️ <b>R2에 매번 실제 용량을 묻지 않는다.</b> {@code ListObjects}는 Class A
 * 연산이라, 화면을 열 때마다 부르면 세려던 비용을 세는 행위가 만들어낸다.
 * 대신 DB에 적어둔 {@code size_bytes} 합계를 쓴다 (ARCHITECTURE.md §3.2).
 * 그래서 <b>DB 값과 R2 실제 용량이 어긋나면 이 가드는 틀린 값을 지킨다</b> —
 * 삭제 시 R2 객체 동반 삭제와 PENDING 정리 배치가 그 어긋남을 막는 쪽이다.
 */
@Slf4j
@Service
public class StorageUsageService {

    private final List<StorageSource> sources;
    private final PhotoRepository photoRepository;
    private final StorageProperties properties;

    StorageUsageService(List<StorageSource> sources,
                        PhotoRepository photoRepository,
                        StorageProperties properties) {
        this.sources = sources;
        this.photoRepository = photoRepository;
        this.properties = properties;

        // 소비처가 하나도 안 잡히면 사용량이 영원히 0으로 나오고, 가드는
        // 아무것도 막지 않으면서 막고 있는 것처럼 보인다. 기동 때 잡는다.
        if (sources.isEmpty()) {
            throw new IllegalStateException("StorageSource 빈이 하나도 없다 — 용량 가드가 무력화된다");
        }
        log.info("저장 용량 가드: 한도 {}바이트 · 경고 {}% · 차단 {}% · 소비처 {}",
                properties.limitBytes(), properties.warnPercent(), properties.blockPercent(),
                sources.stream().map(StorageSource::name).toList());
    }

    // ── §8.5 조회 ────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public StorageUsage usage() {
        long used = usedBytes();
        long photoCount = photoRepository.countByStatus(PhotoStatus.COMMITTED);

        return new StorageUsage(
                used,
                properties.limitBytes(),
                percentOf(used),
                photoCount,
                estimatedRemainingPhotos(used, photoCount),
                properties.warnPercent(),
                properties.blockPercent(),
                used >= properties.blockThresholdBytes());
    }

    // ── 업로드 관문 ──────────────────────────────────────────────────

    /**
     * 업로드해도 되는지 (§8.5 · §6.5).
     *
     * <p><b>올릴 크기를 더해서 판단한다.</b> 현재 사용량만 보면 마지막 한 건이
     * 한도를 넘겨도 통과한다 — 그 한 건이 3GB짜리일 수도 있다.
     *
     * <p>차단 지점이 100%가 아니라 95%인 이유도 같다. 한도에 닿은 뒤 막으면
     * 이미 과금이 시작된 뒤다.
     *
     * @param incomingBytes 이번에 올릴 바이트 수
     * @throws ApiException {@code STORAGE_LIMIT} (409)
     */
    @Transactional(readOnly = true)
    public void assertCanUpload(long incomingBytes) {
        if (incomingBytes < 0) {
            throw new IllegalArgumentException("올릴 크기가 음수다: " + incomingBytes);
        }
        long used = usedBytes();
        long after = used + incomingBytes;
        long block = properties.blockThresholdBytes();

        if (after >= block) {
            // ⚠️ 사용자에게는 숫자를 주지 않는다 — 남의 사진 총량은 알 일이 아니다.
            //    운영자가 볼 값은 로그와 §8.5 화면에 있다.
            log.warn("업로드 차단: 사용 {}바이트 + 요청 {}바이트 = {}바이트 (차단선 {}바이트)",
                    used, incomingBytes, after, block);
            throw ApiException.storageLimit(
                    "저장 공간이 거의 찼습니다. 임원에게 문의해 주세요.");
        }
        warnIfNearLimit(after);
    }

    // ── 보조 ─────────────────────────────────────────────────────────

    /** 모든 소비처의 합 */
    private long usedBytes() {
        long total = 0;
        for (StorageSource source : sources) {
            total += source.usedBytes();
        }
        return total;
    }

    private void warnIfNearLimit(long used) {
        if (percentOf(used) >= properties.warnPercent()) {
            log.warn("⚠️ 저장 용량 {}% — 경고선({}%)을 넘었다. 정리하거나 한도를 다시 볼 것",
                    String.format("%.1f", percentOf(used)), properties.warnPercent());
        }
    }

    /** 소수 한 자리 (§8.5 {@code usagePercent}) */
    private double percentOf(long used) {
        return Math.round(used * 1000.0 / properties.limitBytes()) / 10.0;
    }

    /**
     * 차단선까지 사진을 몇 장 더 올릴 수 있는지 (§8.5).
     *
     * <p>실제로 올라간 사진들의 평균 크기로 나눈다. <b>한 장도 없으면</b>
     * 평균을 낼 수 없어 설정된 대체값을 쓴다 — 0으로 나누면 500이 난다.
     */
    private long estimatedRemainingPhotos(long used, long photoCount) {
        long remaining = properties.blockThresholdBytes() - used;
        if (remaining <= 0) {
            return 0;
        }
        long average = photoCount > 0
                ? Math.max(1, photoRepository.sumCommittedSizeBytes() / photoCount)
                : properties.averagePhotoBytes();
        return remaining / average;
    }
}
