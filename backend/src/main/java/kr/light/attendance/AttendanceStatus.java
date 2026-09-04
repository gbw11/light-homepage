package kr.light.attendance;

/**
 * 출결 상태 (SPEC_API.md §13.0).
 *
 * <p>⚠️ <b>"기록 없음"은 이 열거형에 없다.</b> 명세가 {@code null}(기록 없음)과
 * {@link #ABSENT}를 구별하라고 못 박고 있는데, 여기에 값을 하나 더 두면
 * <b>둘 다 "기록 없음"을 뜻하는 표현이 생긴다.</b> 기록 없음은
 * {@code attendance_entries}에 <b>행이 없는 것</b>으로 표현한다.
 */
public enum AttendanceStatus {
    /** 출석 */
    PRESENT,
    /** 지각 */
    LATE,
    /** 결석 — ⚠️ "아무도 체크하지 않음"과 다르다 */
    ABSENT,
    /** 공결 */
    EXCUSED
}
