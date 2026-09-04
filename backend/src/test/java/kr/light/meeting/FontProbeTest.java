package kr.light.meeting;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.awt.Font;
import java.awt.GraphicsEnvironment;
import java.util.Arrays;

/**
 * ⚠️ 워터마크에 한글을 그릴 수 있는지 <b>먼저 확인한다</b>.
 *
 * <p>컨테이너에 한글 폰트가 없으면 워터마크가 {@code □□□}로 나온다. 그런데
 * 그건 <b>예외가 아니라 조용한 실패</b>다 — 이미지는 정상적으로 만들어지고,
 * 배포한 뒤 누군가 페이지를 열어봐야 알게 된다.
 */
class FontProbeTest {

    @Test
    @DisplayName("이 JVM이 한글을 그릴 수 있나")
    void 한글_렌더링_가능() {
        String sample = "김도연 5678";

        String[] names = GraphicsEnvironment.getLocalGraphicsEnvironment()
                .getAvailableFontFamilyNames();

        System.out.printf("%n=== 폰트 실측 ===%n");
        System.out.printf("  사용 가능 폰트 : %d개%n", names.length);

        // 한글을 실제로 표현할 수 있는 폰트만 골라낸다
        var korean = Arrays.stream(names)
                .filter(name -> new Font(name, Font.PLAIN, 12).canDisplayUpTo(sample) < 0)
                .toList();

        System.out.printf("  한글 가능      : %d개%n", korean.size());
        korean.stream().limit(10).forEach(n -> System.out.printf("    - %s%n", n));

        Font fallback = new Font(Font.SANS_SERIF, Font.PLAIN, 12);
        int cannot = fallback.canDisplayUpTo(sample);
        System.out.printf("  SANS_SERIF로 \"%s\" : %s%n",
                sample, cannot < 0 ? "그릴 수 있음" : ("%d번째 글자부터 못 그림".formatted(cannot)));
        System.out.printf("  headless        : %s%n", GraphicsEnvironment.isHeadless());
    }
}
