package kr.light.storage;

import kr.light.album.Album;
import kr.light.common.ApiException;
import kr.light.common.ErrorCode;
import kr.light.photo.Photo;
import kr.light.photo.PhotoRepository;
import kr.light.photo.PhotoStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 저장 용량 가드 (SPEC_API.md §8.5 · ARCHITECTURE.md §4.3).
 *
 * <p>⚠️ <b>이것이 지금 유일하게 실질적인 과금 방어다.</b> 2026-09-03에 R2에
 * 결제 수단을 등록하면서 1차 방어("카드가 없으니 과금이 불가능")가 사라졌다.
 * 이 클래스가 통과하지 않으면 막는 것이 아무것도 없다.
 */
@SpringBootTest
@ActiveProfiles("test")
class StorageUsageServiceTest {

    private static final long LIMIT = 10_737_418_240L;   // 10GB
    private static final long BLOCK = LIMIT / 100 * 95;  // 95%

    @Autowired StorageUsageService service;
    @Autowired PhotoRepository photoRepository;
    @Autowired List<StorageSource> sources;
    @Autowired kr.light.album.AlbumRepository albumRepository;

    private Album album;

    @BeforeEach
    void setUp() {
        photoRepository.deleteAllInBatch();
        albumRepository.deleteAllInBatch();
        album = albumRepository.saveAndFlush(Album.builder().title("테스트 앨범").build());
    }

    // ── 합계 ─────────────────────────────────────────────────

    @Test
    @DisplayName("★ 소비처가 셋 다 등록돼 있다 — 하나라도 빠지면 용량이 조용히 샌다")
    void 소비처_전부_등록() {
        // 사진첩 · 첨부(주보 포함) · 월례회 문서.
        // R2에 객체를 올리는 기능을 추가하면 StorageSource 구현도 함께 만들어야 한다.
        assertThat(sources).extracting(StorageSource::name)
                .containsExactlyInAnyOrder("사진첩", "첨부·주보", "월례회 문서");
    }

    @Test
    @DisplayName("커밋된 사진만 센다 — PENDING은 size_bytes가 0이라 더해도 의미가 없다")
    void 커밋된_것만_센다() {
        savePhoto(1_000_000, PhotoStatus.COMMITTED);
        savePhoto(9_000_000, PhotoStatus.PENDING);

        assertThat(service.usage().usedBytes()).isEqualTo(1_000_000);
        assertThat(service.usage().photoCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("비어 있으면 0%다 — 나눗셈이 터지지 않는다")
    void 빈_상태() {
        var usage = service.usage();

        assertThat(usage.usedBytes()).isZero();
        assertThat(usage.usagePercent()).isZero();
        assertThat(usage.uploadBlocked()).isFalse();
        // 사진이 없으면 실측 평균을 낼 수 없다 — 설정된 대체값으로 추정한다
        assertThat(usage.estimatedRemainingPhotos()).isPositive();
    }

    @Test
    @DisplayName("계약이 정한 필드가 그대로 나온다 (§8.5)")
    void 응답_형태() {
        savePhoto(LIMIT / 10, PhotoStatus.COMMITTED);   // 10%

        var usage = service.usage();

        assertThat(usage.limitBytes()).isEqualTo(LIMIT);
        assertThat(usage.usagePercent()).isEqualTo(10.0);
        assertThat(usage.warningThreshold()).isEqualTo(80);
        assertThat(usage.blockThreshold()).isEqualTo(95);
        assertThat(usage.uploadBlocked()).isFalse();
    }

    // ── 업로드 관문 ──────────────────────────────────────────

    @Test
    @DisplayName("★ 올릴 크기를 더해서 판단한다 — 현재 사용량만 보면 마지막 한 건이 한도를 넘긴다")
    void 올릴_크기를_더한다() {
        // 차단선 바로 아래까지 채운다
        savePhoto(BLOCK - 1_000, PhotoStatus.COMMITTED);

        // 지금 사용량만 보면 통과다. 하지만 이걸 더하면 넘는다.
        assertThatThrownBy(() -> service.assertCanUpload(2_000))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).code())
                .isEqualTo(ErrorCode.STORAGE_LIMIT);
    }

    @Test
    @DisplayName("차단선 아래면 통과한다")
    void 여유가_있으면_통과() {
        savePhoto(LIMIT / 2, PhotoStatus.COMMITTED);

        assertThatCode(() -> service.assertCanUpload(1_000_000)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("★ 차단은 100%가 아니라 95%다 — 한도에서 막으면 이미 과금된 뒤다")
    void 차단선은_95퍼센트() {
        savePhoto(BLOCK, PhotoStatus.COMMITTED);

        var usage = service.usage();
        assertThat(usage.uploadBlocked()).isTrue();
        assertThat(usage.usagePercent()).isLessThan(100.0);   // 아직 한도 전이다
        assertThat(usage.estimatedRemainingPhotos()).isZero();

        assertThatThrownBy(() -> service.assertCanUpload(1))
                .isInstanceOf(ApiException.class);
    }

    @Test
    @DisplayName("⚠️ 막는 메시지에 용량 숫자가 없다 — 남의 사진 총량은 알 일이 아니다")
    void 메시지에_숫자가_없다() {
        savePhoto(BLOCK, PhotoStatus.COMMITTED);

        assertThatThrownBy(() -> service.assertCanUpload(1))
                .hasMessageNotContaining("바이트")
                .hasMessageNotContaining(String.valueOf(BLOCK));
    }

    @Test
    @DisplayName("음수 크기는 프로그래밍 오류다 — 통과시키면 가드를 우회할 수 있다")
    void 음수_크기() {
        assertThatThrownBy(() -> service.assertCanUpload(-1))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ── 보조 ─────────────────────────────────────────────────

    private void savePhoto(long sizeBytes, PhotoStatus status) {
        Photo photo = Photo.builder()
                .album(album)
                .r2KeyView("view/%d-%s".formatted(sizeBytes, status))
                .r2KeyThumb("thumb/%d-%s".formatted(sizeBytes, status))
                .sizeBytes(status == PhotoStatus.COMMITTED ? sizeBytes : 0)
                .status(status)
                .build();
        photoRepository.saveAndFlush(photo);
    }
}
