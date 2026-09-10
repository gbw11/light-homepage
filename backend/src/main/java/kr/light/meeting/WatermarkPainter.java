package kr.light.meeting;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.AlphaComposite;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

/**
 * 페이지 이미지에 워터마크를 <b>픽셀로 태운다</b> (SPEC_API.md §7.3).
 *
 * <h2>왜 CSS가 아니라 서버인가</h2>
 * 화면에 오버레이로 얹은 워터마크는 개발자도구에서 두 번 클릭이면 사라진다.
 * 여기서 태운 것은 <b>캡처한 이미지에 그대로 남는다.</b>
 *
 * <h2>⚠️ 워터마크는 캡처를 막지 못한다</h2>
 * 막을 수 없어서 넣는 것이다 ({@code ARCHITECTURE.md §7.7}). 이 기능의 수준은
 * <b>"실수·무심한 유출을 막고, 고의 유출은 추적한다"</b>이고, 그 이상으로
 * 믿게 만들면 안 된다 — 막았다고 믿고 더 민감한 자료를 올리는 것이 가장
 * 위험한 결과다.
 *
 * <h2>⚠️ 한글 폰트가 없으면 조용히 □□□가 된다</h2>
 * 예외가 아니라 <b>정상적으로 만들어진 잘못된 이미지</b>다. 배포한 뒤 누군가
 * 열어봐야 알게 되므로, 기동 시점에 확인하고 경고를 남긴다
 * ({@code Dockerfile}에 {@code font-noto-cjk}를 넣어둔 이유).
 */
@Slf4j
@Component
public class WatermarkPainter {

    /** 글자 크기 — 장변 2048px 기준. 읽을 수 있어야 추적에 쓸 수 있다 */
    private static final float FONT_RATIO = 0.022f;

    /**
     * 불투명도.
     *
     * <p>진하면 자료를 읽을 수 없고, 옅으면 캡처 뒤 판독이 안 된다. 0.28은
     * 본문 글자와 겹쳐도 읽히면서 워터마크도 읽히는 지점이다.
     */
    private static final float OPACITY = 0.28f;

    /** 대각선 반복 간격 (장변 대비). 한 군데만 박으면 잘라내면 사라진다 */
    private static final double TILE_RATIO = 0.42;

    private static final float JPEG_QUALITY = 0.85f;

    private final boolean koreanRenderable;

    WatermarkPainter() {
        this.koreanRenderable =
                new Font(Font.SANS_SERIF, Font.PLAIN, 12).canDisplayUpTo("가") < 0;

        if (koreanRenderable) {
            log.info("워터마크 폰트 확인: 한글 렌더링 가능");
        } else {
            // ⚠️ 기동을 막지는 않는다 — 월례회 말고 다른 기능은 멀쩡하다.
            //    다만 이 상태로 배포되면 워터마크가 □□□가 되어 추적이 불가능하다.
            log.error("""
                    ⚠️ 한글 폰트가 없다 — 월례회 워터마크가 □□□로 나온다.
                       추적 수단이 무력화되므로 자료를 올리기 전에 반드시 고칠 것.
                       컨테이너: apk add font-noto-cjk (Dockerfile 참고)""");
        }
    }

    /**
     * 워터마크를 합성해 JPEG로 돌려준다.
     *
     * @param label 태울 문구. {@code "김도연 5678 · 2026-08-24 14:03 · #3"}
     */
    public byte[] paint(InputStream pageImage, String label) throws IOException {
        BufferedImage source = ImageIO.read(pageImage);
        if (source == null) {
            throw new IOException("페이지 이미지를 읽을 수 없다");
        }

        // ⚠️ 원본에 직접 그리지 않는다. ImageIO.read가 준 이미지는 타입이
        //    제각각이라(인덱스 컬러 등) 그 위에 알파 합성을 하면 색이 뭉개진다.
        BufferedImage canvas = new BufferedImage(
                source.getWidth(), source.getHeight(), BufferedImage.TYPE_INT_RGB);

        Graphics2D g = canvas.createGraphics();
        try {
            g.drawImage(source, 0, 0, null);
            source.flush();

            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING,
                    RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, OPACITY));

            int longEdge = Math.max(canvas.getWidth(), canvas.getHeight());
            g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, Math.round(longEdge * FONT_RATIO)));

            drawTiled(g, canvas.getWidth(), canvas.getHeight(), label, longEdge);
        } finally {
            g.dispose();
        }
        return toJpeg(canvas);
    }

    /** 폰트가 한글을 그릴 수 있는가 — 진단용 */
    public boolean isKoreanRenderable() {
        return koreanRenderable;
    }

    // ── 보조 ─────────────────────────────────────────────────────────

    /**
     * 대각선으로 반복해서 깐다.
     *
     * <p>⚠️ 한 군데만 박으면 <b>그 부분만 잘라내면 사라진다.</b> 캡처한 뒤
     * 크롭하는 것은 아주 쉬운 일이라, 페이지 전체에 걸쳐야 의미가 있다.
     */
    private static void drawTiled(Graphics2D g, int width, int height,
                                  String label, int longEdge) {
        g.setColor(Color.DARK_GRAY);

        int step = (int) Math.round(longEdge * TILE_RATIO);
        AffineTransform original = g.getTransform();

        // 대각선(-30°)으로 눕힌다 — 가로로 깔면 본문 줄과 겹쳐 둘 다 읽기 어렵다
        for (int y = -height; y < height * 2; y += step) {
            for (int x = -width; x < width * 2; x += step) {
                g.setTransform(original);
                g.rotate(Math.toRadians(-30), x, y);
                g.drawString(label, x, y);
            }
        }
        g.setTransform(original);
    }

    private static byte[] toJpeg(BufferedImage image) throws IOException {
        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        try (ByteArrayOutputStream out = new ByteArrayOutputStream();
             ImageOutputStream stream = ImageIO.createImageOutputStream(out)) {

            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(JPEG_QUALITY);

            writer.setOutput(stream);
            writer.write(null, new IIOImage(image, null, null), param);
            stream.flush();
            return out.toByteArray();
        } finally {
            writer.dispose();
            image.flush();
        }
    }
}
