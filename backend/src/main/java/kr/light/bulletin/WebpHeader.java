package kr.light.bulletin;

import java.awt.Dimension;

/**
 * WebP 헤더에서 픽셀 크기만 꺼낸다.
 *
 * <p><b>⚠️ Java {@code ImageIO}는 WebP를 읽지 못한다.</b> 그런데 FE가 주보를
 * 2048px WebP로 변환해 올리므로(§5.4), 그것이 기본 경로다. 크기를 못 읽으면
 * {@code §5.1}의 {@code width}·{@code height}가 null로 나가고 FE 타입과
 * 어긋난다.
 *
 * <p>디코딩은 필요 없다 — <b>헤더 몇 바이트만</b> 읽으면 된다. 그래서
 * 네이티브 라이브러리를 붙이지 않고 직접 읽는다.
 *
 * <p>형식 (RIFF 컨테이너):
 * <pre>
 *   0..3   "RIFF"
 *   4..7   파일 크기
 *   8..11  "WEBP"
 *   12..15 청크 ID — "VP8 "(손실) · "VP8L"(무손실) · "VP8X"(확장)
 * </pre>
 */
final class WebpHeader {

    private WebpHeader() {
    }

    /** WebP가 아니거나 읽을 수 없으면 null */
    static Dimension dimensionOf(byte[] head) {
        if (head.length < 30 || !matches(head, 0, "RIFF") || !matches(head, 8, "WEBP")) {
            return null;
        }
        String chunk = new String(head, 12, 4, java.nio.charset.StandardCharsets.US_ASCII);

        return switch (chunk) {
            // 손실: 20번지부터 14비트씩
            case "VP8 " -> new Dimension(
                    le16(head, 26) & 0x3FFF,
                    le16(head, 28) & 0x3FFF);
            // 무손실: 21번지부터 14비트씩 (비트 경계가 바이트에 걸쳐 있다)
            case "VP8L" -> vp8l(head);
            // 확장: 24번지부터 24비트씩, 값은 (실제 - 1)
            case "VP8X" -> new Dimension(
                    (le24(head, 24) & 0xFFFFFF) + 1,
                    (le24(head, 27) & 0xFFFFFF) + 1);
            default -> null;
        };
    }

    private static Dimension vp8l(byte[] head) {
        int bits = (head[21] & 0xFF)
                | ((head[22] & 0xFF) << 8)
                | ((head[23] & 0xFF) << 16)
                | ((head[24] & 0xFF) << 24);
        return new Dimension((bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1);
    }

    private static boolean matches(byte[] bytes, int offset, String token) {
        for (int i = 0; i < token.length(); i++) {
            if (bytes[offset + i] != token.charAt(i)) {
                return false;
            }
        }
        return true;
    }

    private static int le16(byte[] b, int i) {
        return (b[i] & 0xFF) | ((b[i + 1] & 0xFF) << 8);
    }

    private static int le24(byte[] b, int i) {
        return (b[i] & 0xFF) | ((b[i + 1] & 0xFF) << 8) | ((b[i + 2] & 0xFF) << 16);
    }
}
