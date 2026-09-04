package kr.light.meeting;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * PDF 변환 실측 — <b>Render 무료 인스턴스에서 타임아웃 나지 않는지</b>가 관심사다.
 *
 * <p>§7.4가 "10페이지 내외 기준 15~30초"로 잡고 있는데, 그 값이 맞는지와
 * 메모리가 512MB 안에서 도는지를 실제로 재본다. 스프링 컨텍스트가 필요 없다.
 */
class PdfPerfTest {

    @Test
    @DisplayName("10쪽 변환 시간과 메모리를 잰다")
    void 실측() throws Exception {
        byte[] pdf = pdf(10);
        PdfPageRenderer renderer = new PdfPageRenderer();

        Runtime runtime = Runtime.getRuntime();
        System.gc();
        long before = runtime.totalMemory() - runtime.freeMemory();
        AtomicLong totalJpegBytes = new AtomicLong();

        long startedAt = System.currentTimeMillis();
        int pages = renderer.render(new ByteArrayInputStream(pdf),
                (jpeg, pageNo) -> totalJpegBytes.addAndGet(jpeg.length));
        long elapsed = System.currentTimeMillis() - startedAt;

        long after = runtime.totalMemory() - runtime.freeMemory();

        System.out.printf("%n=== PDF 변환 실측 ===%n");
        System.out.printf("  페이지        : %d쪽%n", pages);
        System.out.printf("  소요          : %dms (쪽당 %dms)%n", elapsed, elapsed / pages);
        System.out.printf("  원본 PDF      : %,d바이트%n", pdf.length);
        System.out.printf("  생성 JPEG 합계 : %,d바이트 (쪽당 %,d)%n",
                totalJpegBytes.get(), totalJpegBytes.get() / pages);
        System.out.printf("  힙 증가       : %,d바이트%n", after - before);
        System.out.printf("  힙 최대       : %,d바이트%n", runtime.maxMemory());

        assertThat(pages).isEqualTo(10);

        // ⚠️ 숫자를 못 박지 않는다 — 기기마다 다르고, 실제 월례회 PDF는 이보다
        //    무겁다(이미지·한글 임베드 폰트). 다만 **병적으로 느려지는 회귀**는
        //    잡아야 한다. §7.4가 잡아둔 상한(30초)을 기준으로 둔다.
        assertThat(elapsed)
                .as("10쪽 변환이 30초를 넘으면 Render에서 요청이 끊긴다")
                .isLessThan(30_000);
    }

    private byte[] pdf(int pageCount) throws Exception {
        try (PDDocument document = new PDDocument();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            for (int i = 1; i <= pageCount; i++) {
                PDPage page = new PDPage(PDRectangle.A4);
                document.addPage(page);
                try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                    content.beginText();
                    content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 11);
                    content.newLineAtOffset(56, 780);
                    // 실제 월례회 자료처럼 글자를 빽빽하게 — 렌더링 부하를 비슷하게 만든다
                    for (int line = 0; line < 45; line++) {
                        content.showText("2026 August meeting minutes line " + line
                                + " budget report attendance summary");
                        content.newLineAtOffset(0, -16);
                    }
                    content.endText();
                }
            }
            document.save(out);
            return out.toByteArray();
        }
    }
}
