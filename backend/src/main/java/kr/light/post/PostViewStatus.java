package kr.light.post;

/**
 * 회의록 · 예산안의 열람 상태. 저장되는 값이 아니라 현재 시각으로 계산한다
 * (월례회 {@code MeetingDocStatus}와 같은 이름 · 같은 뜻).
 *
 * <p>기간 밖의 글도 목록에는 남는다 — 존재는 알리되 내용은 막는다 (2026-10-19 결정).
 * 공지에는 기간이 없으므로 이 값도 없다(null).
 */
public enum PostViewStatus {
    /** 열람 시작 전 */
    SCHEDULED,
    /** 열람 가능 */
    OPEN,
    /** 기간 종료 — 또는 기간이 정해지지 않은 예전 글(V11 이전) */
    CLOSED
}
