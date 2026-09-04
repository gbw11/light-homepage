package kr.light.attendance;

/**
 * 회차 종류 (SPEC_API.md §13.1).
 *
 * <p>명세는 "값 목록은 BE 합의 대상"으로 두었고, FE 타입도 이 둘이다
 * ({@code AttendanceSessionType}). <b>이 둘로 확정한다.</b>
 *
 * <p>값을 늘리면 FE의 라벨·필터가 함께 바뀌어야 하므로 계약 변경이다 —
 * 조용히 추가하지 않는다.
 */
public enum AttendanceSessionType {
    /** 주일예배 */
    SUNDAY_SERVICE,
    /** 그 밖의 모임 — 수련회·특별집회 등 */
    ETC
}
