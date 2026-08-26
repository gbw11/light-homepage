package kr.light.meeting;

/**
 * 월례회 자료의 열람 상태. 저장되는 값이 아니라 현재 시각으로 계산한다.
 *
 * <p>종료된 자료도 목록에는 남는다 — 존재는 알리되 내용은 차단한다
 * (SPEC_API.md §7.1).
 */
public enum MeetingDocStatus {
    /** 열람 시작 전 */
    SCHEDULED,
    /** 열람 가능 */
    OPEN,
    /** 기간 종료 — MEMBER는 열람 불가 */
    CLOSED
}
