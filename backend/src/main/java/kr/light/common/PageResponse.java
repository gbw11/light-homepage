package kr.light.common;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

/**
 * 페이지 목록 응답 — {@code { "items": [], "page": 0, "size": 20, "hasNext": true }}.
 *
 * <p>기본값은 {@code page=0}, {@code size=20}(최대 100) (SPEC_API.md §1.6).
 * 사진 목록만 커서 방식을 쓴다 → {@link CursorResponse}.
 *
 * <p>{@code page}·{@code size}는 숫자로 내보낸다. 문자열 규칙은 ID에만 적용된다.
 */
public record PageResponse<T>(
        List<T> items,
        int page,
        int size,
        boolean hasNext
) {

    public static <T> PageResponse<T> of(Page<T> page) {
        return new PageResponse<>(
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.hasNext()
        );
    }

    /** 엔티티 페이지를 DTO로 변환하면서 감싼다 */
    public static <E, T> PageResponse<T> of(Page<E> page, Function<E, T> mapper) {
        return new PageResponse<>(
                page.getContent().stream().map(mapper).toList(),
                page.getNumber(),
                page.getSize(),
                page.hasNext()
        );
    }
}
