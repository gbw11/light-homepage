package kr.light.common;

/**
 * 성공 응답 봉투 — {@code { "data": ... }}.
 *
 * <p>FE는 에러 처리를 한 곳에서 만들 수 있게 모든 성공 응답이 이 형태로 나가야
 * 한다 (SPEC_API.md §1.1).
 *
 * <p><b>⚠️ ID는 문자열로 직렬화한다.</b> JS {@code Number}의 정밀도 이슈를
 * 회피하기 위한 규칙이며, DTO에서 {@code String id}로 선언해 지킨다.
 * 전역 Long→String 직렬화는 쓰지 않는다 — {@code sizeBytes}·{@code page}·
 * {@code photoCount}처럼 숫자로 나가야 하는 필드까지 문자열이 되어 오히려
 * 계약을 깬다 (SPEC_API.md §1.3, §8.5 참조).
 */
public record ApiResponse<T>(T data) {

    public static <T> ApiResponse<T> of(T data) {
        return new ApiResponse<>(data);
    }

    /** 반환할 본문이 없지만 봉투는 유지해야 하는 경우 */
    public static ApiResponse<Void> empty() {
        return new ApiResponse<>(null);
    }
}
