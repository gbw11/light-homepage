package kr.light.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.json.JsonTest;

import java.time.Instant;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 직렬화 규칙 검증 (SPEC_API.md §1.3).
 *
 * <p>애플리케이션이 실제로 쓰는 {@code ObjectMapper}로 검사한다. 여기가
 * 어긋나면 모든 엔드포인트가 한꺼번에 계약을 위반한다.
 *
 * <p>ID만 문자열이고 나머지 숫자는 숫자로 나가야 한다. 전역 Long→String
 * 직렬화를 걸면 {@code sizeBytes}·{@code page}·{@code photoCount}까지
 * 문자열이 되어 오히려 계약을 깬다 — 그래서 DTO에서 {@code String id}로
 * 선언하는 방식을 쓴다.
 */
@JsonTest
class JsonContractTest {

    @Autowired
    ObjectMapper mapper;

    record Sample(
            String id,          // ID는 문자열
            long sizeBytes,     // 용량은 숫자
            int page,           // 페이지는 숫자
            LocalDate serviceDate,
            Instant publishedAt,
            String phone        // null이어도 필드를 남긴다
    ) {}

    @Test
    @DisplayName("시각은 ISO-8601 UTC + Z로 나간다 — 타임스탬프 숫자가 아니다")
    void 시각_직렬화() throws Exception {
        String json = mapper.writeValueAsString(sample());

        assertThat(json).contains("\"publishedAt\":\"2026-08-24T01:00:00Z\"");
    }

    @Test
    @DisplayName("LocalDate는 YYYY-MM-DD로 나간다 — 배열이 아니다")
    void 날짜_직렬화() throws Exception {
        String json = mapper.writeValueAsString(sample());

        assertThat(json).contains("\"serviceDate\":\"2026-08-24\"");
    }

    @Test
    @DisplayName("ID는 문자열, 용량·페이지는 숫자로 나간다")
    void ID만_문자열() throws Exception {
        String json = mapper.writeValueAsString(sample());

        assertThat(json).contains("\"id\":\"18\"");
        assertThat(json).contains("\"sizeBytes\":24576");
        assertThat(json).contains("\"page\":0");
    }

    @Test
    @DisplayName("null 필드는 생략하지 않고 명시한다")
    void null_명시() throws Exception {
        String json = mapper.writeValueAsString(sample());

        assertThat(json).contains("\"phone\":null");
    }

    private Sample sample() {
        return new Sample(
                "18",
                24576L,
                0,
                LocalDate.of(2026, 8, 24),
                Instant.parse("2026-08-24T01:00:00Z"),
                null
        );
    }
}
