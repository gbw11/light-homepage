package kr.light.storage;

/**
 * R2 연산 등급 (Cloudflare 가격 정책).
 *
 * <p>★ <b>presigned URL "발급"은 어느 쪽도 아니다.</b> 서명은 우리 서버의 암호
 * 연산이고 R2를 호출하지 않는다. 과금은 <b>그 URL로 실제 요청이 갈 때</b>
 * 일어난다 — 즉 브라우저가 업로드하면 {@link #A}, 내려받으면 {@link #B}다.
 * URL만 발급하고 쓰지 않는 재시도 루프는 $0이다.
 *
 * <p>{@code DeleteObject}는 <b>무료</b>라 등급이 없다. 지우는 것을 아까워할
 * 이유가 없다는 뜻이다.
 */
public enum R2OperationClass {

    /** 쓰기 — {@code PutObject} · {@code CopyObject} · {@code ListObjects} · 멀티파트. 월 100만 무료 */
    A(1_000_000L),

    /** 읽기 — {@code GetObject} · {@code HeadObject}. 월 1,000만 무료 */
    B(10_000_000L);

    private final long freePerMonth;

    R2OperationClass(long freePerMonth) {
        this.freePerMonth = freePerMonth;
    }

    public long freePerMonth() {
        return freePerMonth;
    }
}
