package kr.light.meeting;

import kr.light.common.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.stereotype.Component;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.function.ObjIntConsumer;

/**
 * PDF를 페이지 이미지로 바꾼다 (SPEC_API.md §7.4).
 *
 * <h2>⚠️ 메모리가 이 클래스의 제약이다</h2>
 * Render 무료 인스턴스가 RAM 512MB다. PDF 전체를 한 번에 이미지로 만들어 들고
 * 있으면 10페이지짜리도 넘긴다 — A4를 장변 2048px로 렌더링하면 한 장이
 * <b>비압축 상태로 약 12MB</b>다(2048 × 1448 × 4바이트).
 *
 * <p>그래서 <b>한 장 만들고 즉시 넘긴 뒤 버린다.</b> 호출부가 그 자리에서
 * R2로 올려야 하고, 목록에 모아두면 안 된다 — 그러려고 {@code List}를
 * 반환하지 않고 {@link ObjIntConsumer}를 받는다.
 */
@Slf4j
@Component
public class PdfPageRenderer {

    /**
     * 장변 픽셀 (§7.4).
     *
     * <p>월례회 자료는 글자를 읽어야 하므로 사진첩(2560)보다 작지만 주보와
     * 같은 급이 필요하다. 너무 키우면 메모리와 R2 용량이 함께 오른다.
     */
    private static final int LONG_EDGE = 2048;

    /**
     * 페이지 수 상한.
     *
     * <p>동기 처리라 페이지가 많으면 요청이 그만큼 길어진다. 월례회 자료는
     * 10페이지 내외이고, 상한이 없으면 실수로 올린 200쪽짜리가 요청 하나를
     * 몇 분씩 붙잡는다.
     */
    static final int MAX_PAGES = 50;

    /** JPEG 품질. 글자를 읽어야 해서 낮출 수 없다 */
    private static final float JPEG_QUALITY = 0.85f;

    /**
     * 페이지마다 {@code onPage}를 부른다.
     *
     * <p>⚠️ {@code onPage}가 받은 바이트는 <b>그 호출 안에서 다 써야 한다.</b>
     * 다음 페이지를 만들면서 앞 장은 회수된다.
     *
     * @param onPage {@code (jpegBytes, pageNo)} — pageNo는 1부터
     * @return 변환한 페이지 수
     */
    public int render(InputStream pdf, ObjIntConsumer<byte[]> onPage) {
        long startedAt = System.currentTimeMillis();

        try (PDDocument document = Loader.loadPDF(pdf.readAllBytes())) {
            if (document.isEncrypted()) {
                // 암호가 걸린 PDF는 렌더링이 실패하거나 빈 페이지가 나온다.
                // 여기서 막지 않으면 "올라갔는데 아무것도 안 보이는" 자료가 생긴다.
                throw ApiException.validation("file", "암호가 걸린 PDF는 올릴 수 없습니다.");
            }
            int pageCount = document.getNumberOfPages();
            if (pageCount == 0) {
                throw ApiException.validation("file", "페이지가 없는 PDF입니다.");
            }
            if (pageCount > MAX_PAGES) {
                throw ApiException.validation("file",
                        "%d쪽까지 올릴 수 있습니다.".formatted(MAX_PAGES));
            }

            PDFRenderer renderer = new PDFRenderer(document);
            for (int index = 0; index < pageCount; index++) {
                // ⚠️ GRAY가 아니라 RGB다. 표·그래프에 색이 있으면 회색조로
                //    뭉개져 읽을 수 없게 된다.
                BufferedImage page = renderer.renderImageWithDPI(
                        index, dpiFor(document, index), ImageType.RGB);

                onPage.accept(toJpeg(page), index + 1);

                // 다음 장을 만들기 전에 놓아준다 — 512MB에서 이게 없으면 쌓인다
                page.flush();
            }

            log.info("PDF 변환 완료: {}쪽 {}ms", pageCount, System.currentTimeMillis() - startedAt);
            return pageCount;

        } catch (ApiException e) {
            throw e;
        } catch (IOException | RuntimeException e) {
            // ⚠️ 예외 메시지를 사용자에게 그대로 주지 않는다. PDFBox의 메시지는
            //    내부 구조를 드러내고, 사용자가 할 수 있는 일도 없다.
            log.warn("PDF 변환 실패: {}", e.getClass().getSimpleName());
            throw ApiException.validation("file", "PDF를 읽을 수 없습니다. 파일을 확인해 주세요.");
        }
    }

    // ── 보조 ─────────────────────────────────────────────────────────

    /**
     * 장변이 {@link #LONG_EDGE}가 되는 DPI.
     *
     * <p>PDF는 페이지마다 크기가 다를 수 있다(A4에 가로 페이지가 섞이는 식).
     * 고정 DPI를 쓰면 어떤 장은 너무 크고 어떤 장은 작아진다 — 큰 쪽은 메모리를
     * 먹고, 작은 쪽은 글자를 읽을 수 없다.
     *
     * <p>PDF 좌표는 포인트(1/72인치) 단위다.
     */
    private static float dpiFor(PDDocument document, int pageIndex) {
        PDRectangle box = document.getPage(pageIndex).getMediaBox();
        float longEdgePoints = Math.max(box.getWidth(), box.getHeight());
        if (longEdgePoints <= 0) {
            return 150f;   // 비정상 페이지 — 기본값으로 넘어간다
        }
        return LONG_EDGE * 72f / longEdgePoints;
    }

    /**
     * JPEG로 인코딩한다.
     *
     * <p>⚠️ {@code ImageIO.write}는 품질을 지정할 수 없다 — 기본값이 낮아
     * 작은 글자가 뭉개진다. 월례회 자료는 읽으라고 올리는 것이라
     * {@link ImageWriteParam}으로 품질을 올린다.
     */
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
        }
    }
}
