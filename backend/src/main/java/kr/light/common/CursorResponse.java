package kr.light.common;

import java.util.List;

/**
 * 커서 목록 응답 — {@code { "items": [], "nextCursor": "...", "hasNext": true }}.
 *
 * <p>사진 목록 전용이다. 앨범 하나에 수백 장이 들어가고 무한 스크롤로 훑으므로
 * offset 페이징은 뒤로 갈수록 느려진다 (SPEC_API.md §1.1, §6.4).
 *
 * <p>{@code hasNext}가 false면 {@code nextCursor}는 null이다. FE의 옵셔널
 * 처리를 단순하게 두려고 필드를 생략하지 않고 null을 명시한다 (§1.3).
 */
public record CursorResponse<T>(
        List<T> items,
        String nextCursor,
        boolean hasNext
) {

    public static <T> CursorResponse<T> of(List<T> items, String nextCursor) {
        return new CursorResponse<>(items, nextCursor, nextCursor != null);
    }

    public static <T> CursorResponse<T> last(List<T> items) {
        return new CursorResponse<>(items, null, false);
    }
}
