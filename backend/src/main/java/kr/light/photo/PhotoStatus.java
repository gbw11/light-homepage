package kr.light.photo;

/**
 * 사진 업로드 상태.
 *
 * <p>파일은 브라우저 → R2로 직접 전송되므로(Spring을 통과하지 않는다) 서버는
 * "URL을 발급한 시점"과 "실제로 올라간 시점"을 따로 알아야 한다.
 */
public enum PhotoStatus {
    /** presigned URL만 발급된 상태. 24시간 지나면 정리 배치가 R2 객체와 함께 지운다 */
    PENDING,
    /** R2 업로드가 확인된 상태. 목록에는 이것만 나온다 */
    COMMITTED
}
