package kr.light.bulletin;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.awt.Dimension;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WebP 헤더에서 크기 읽기 (SPEC_API.md §5.1 {@code pages[].width}).
 *
 * <p><b>이 클래스가 왜 필요한가</b> — Java {@code ImageIO}는 WebP를 읽지
 * 못하는데, FE는 주보를 2048px WebP로 변환해 올린다(§5.4). 그래서 크기를
 * 못 읽으면 {@code width}·{@code height}가 <b>항상 null</b>이 되고, FE 타입
 * ({@code number}, non-null)과 어긋난다.
 *
 * <p>실제로 그 상태로 한 번 배포됐다 — V8에서 컬럼은 만들었는데 값을 채우는
 * 코드가 없었다. 열어보고 나서야 알았다.
 */
class WebpHeaderTest {

    @Test
    @DisplayName("★ 무손실(VP8L) WebP의 크기를 읽는다 — FE가 올리는 형식이다")
    void vp8l() throws IOException {
        Dimension size = WebpHeader.dimensionOf(vp8lWebp(1448, 2048));

        assertThat(size).isNotNull();
        assertThat(size.width).isEqualTo(1448);
        assertThat(size.height).isEqualTo(2048);
    }

    @Test
    @DisplayName("1×1도 읽는다 — 값이 (실제 - 1)로 저장되는 형식이라 경계가 틀리기 쉽다")
    void 최소_크기() throws IOException {
        Dimension size = WebpHeader.dimensionOf(vp8lWebp(1, 1));

        assertThat(size).isNotNull();
        assertThat(size.width).isEqualTo(1);
        assertThat(size.height).isEqualTo(1);
    }

    @Test
    @DisplayName("14비트 상한(16383)까지 읽는다")
    void 상한() throws IOException {
        Dimension size = WebpHeader.dimensionOf(vp8lWebp(16383, 16383));

        assertThat(size).isNotNull();
        assertThat(size.width).isEqualTo(16383);
        assertThat(size.height).isEqualTo(16383);
    }

    @Test
    @DisplayName("WebP가 아니면 null — 예외를 던지지 않는다")
    void webp가_아니면() {
        assertThat(WebpHeader.dimensionOf("이건 WebP가 아니다".getBytes())).isNull();
        assertThat(WebpHeader.dimensionOf(new byte[0])).isNull();
        assertThat(WebpHeader.dimensionOf(new byte[30])).isNull();
    }

    @Test
    @DisplayName("RIFF지만 WEBP가 아니면 null (wav 등)")
    void riff이지만_webp가_아니면() {
        byte[] wav = new byte[40];
        System.arraycopy("RIFF".getBytes(), 0, wav, 0, 4);
        System.arraycopy("WAVE".getBytes(), 0, wav, 8, 4);

        assertThat(WebpHeader.dimensionOf(wav)).isNull();
    }

    // ── 보조 ─────────────────────────────────────────────────

    /**
     * VP8L(무손실) WebP 헤더를 만든다.
     *
     * <p>21번지부터 4바이트에 {@code (width-1)} 14비트 + {@code (height-1)}
     * 14비트가 리틀엔디언으로 들어간다.
     */
    private static byte[] vp8lWebp(int width, int height) throws IOException {
        int bits = ((width - 1) & 0x3FFF) | (((height - 1) & 0x3FFF) << 14);

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            out.write("RIFF".getBytes());
            out.write(new byte[]{0, 0, 0, 0});          // 파일 크기 — 여기서는 안 본다
            out.write("WEBP".getBytes());
            out.write("VP8L".getBytes());
            out.write(new byte[]{0, 0, 0, 0});          // 청크 크기
            out.write(0x2F);                            // VP8L 시그니처
            out.write(bits & 0xFF);
            out.write((bits >> 8) & 0xFF);
            out.write((bits >> 16) & 0xFF);
            out.write((bits >> 24) & 0xFF);
            out.write(new byte[16]);                    // 헤더 판정에 필요한 최소 길이 확보
            return out.toByteArray();
        }
    }
}
