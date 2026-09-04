package kr.light.photo;

import kr.light.album.Album;
import kr.light.album.AlbumRepository;
import kr.light.storage.R2Client;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * 미커밋 사진 정리 배치 (SPEC_API.md §6.5).
 *
 * <p><b>★ 이 배치가 지키는 것은 DB가 아니라 R2다.</b> 브라우저가 PUT은 끝냈는데
 * 커밋을 못 부르면 객체가 R2에 남는다. 행만 지우면 <b>아무도 가리키지 않는
 * 객체</b>가 되어 용량이 조용히 새고, 그건 DB 합계로 세는 용량 화면(§8.5)에도
 * 잡히지 않는다 — 즉 보이지 않는 곳에서 돈이 나간다.
 */
@SpringBootTest
@ActiveProfiles("test")
class PendingPhotoCleanupTest {

    @Autowired PhotoService photoService;
    @Autowired PhotoRepository photoRepository;
    @Autowired AlbumRepository albumRepository;

    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @MockitoBean R2Client r2Client;

    private Album album;

    @BeforeEach
    void setUp() {
        photoRepository.deleteAllInBatch();
        albumRepository.deleteAllInBatch();
        album = albumRepository.saveAndFlush(Album.builder().title("정리 대상").build());
    }

    @Test
    @DisplayName("★ 24시간 지난 PENDING은 행과 R2 객체가 함께 사라진다")
    void 오래된_미커밋을_지운다() {
        Photo stale = savePhoto(PhotoStatus.PENDING, Instant.now().minus(25, ChronoUnit.HOURS));

        photoService.cleanUpPending();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Collection<String>> keys = ArgumentCaptor.forClass(Collection.class);
        verify(r2Client).deleteAll(keys.capture());
        assertThat(keys.getValue())
                .as("view와 thumb 둘 다 지워야 한다")
                .containsExactlyInAnyOrder(stale.getR2KeyView(), stale.getR2KeyThumb());

        assertThat(photoRepository.count()).isZero();
    }

    @Test
    @DisplayName("★ 아직 24시간이 안 된 PENDING은 건드리지 않는다 — 올리는 중일 수 있다")
    void 최근_미커밋은_둔다() {
        savePhoto(PhotoStatus.PENDING, Instant.now().minus(1, ChronoUnit.HOURS));

        photoService.cleanUpPending();

        // 느린 회선에서 올리는 중인 사진을 지우면 업로드가 조용히 실패한다
        assertThat(photoRepository.count()).isEqualTo(1);
        verify(r2Client, never()).deleteAll(org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("★ COMMITTED는 아무리 오래돼도 지우지 않는다")
    void 커밋된_것은_안_지운다() {
        savePhoto(PhotoStatus.COMMITTED, Instant.now().minus(365, ChronoUnit.DAYS));

        photoService.cleanUpPending();

        assertThat(photoRepository.count()).isEqualTo(1);
        verify(r2Client, never()).deleteAll(org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("지울 게 없으면 R2를 부르지 않는다 — 빈 호출도 연산이다")
    void 지울_게_없으면() {
        photoService.cleanUpPending();

        verify(r2Client, never()).deleteAll(org.mockito.ArgumentMatchers.any());
    }

    // ── 보조 ─────────────────────────────────────────────────

    /**
     * ⚠️ {@code created_at}을 <b>DB에서 직접</b> 바꾼다.
     *
     * <p>엔티티 필드를 리플렉션으로 고쳐도 소용없다 — {@code updatable = false}라
     * UPDATE 문에 실리지 않는다. 그러면 DB에는 "지금"이 남아 배치가 아무것도
     * 찾지 못하고, 테스트는 <b>통과해야 할 것이 통과하지 않는</b> 모양으로 깨진다.
     * (24시간을 기다릴 수는 없다.)
     */
    private Photo savePhoto(PhotoStatus status, Instant createdAt) {
        Photo photo = photoRepository.saveAndFlush(Photo.builder()
                .album(album)
                .r2KeyView("albums/1/1-view.webp")
                .r2KeyThumb("albums/1/1-thumb.webp")
                .sizeBytes(status == PhotoStatus.COMMITTED ? 1_000 : 0)
                .status(status)
                .build());

        jdbcTemplate.update("UPDATE photos SET created_at = ? WHERE id = ?",
                java.sql.Timestamp.from(createdAt), photo.getId());
        return photo;
    }
}
