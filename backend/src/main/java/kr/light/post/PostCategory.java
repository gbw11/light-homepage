package kr.light.post;

/**
 * 게시물 분류 — 공지·회의록·예산안을 한 테이블에 담고 이 값으로 권한을 가른다.
 *
 * <p>⚠️ 조회에서 이 값의 권한 검사를 빠뜨리면 예산안·회의록이 한 번에 전부
 * 새어나간다. 모든 조회는 PostQueryService의 단일 관문을 통과해야 한다
 * (ARCHITECTURE.md §5.2).
 */
public enum PostCategory {
    /** 공개 공지 — 비로그인 포함 누구나 */
    NOTICE_PUBLIC,
    /** 내부 공지 — MEMBER 이상 */
    NOTICE_MEMBER,
    /** 회의록 — LEADER 이상 */
    MINUTES,
    /** 예산안 — LEADER 이상. 존재 자체를 숨긴다(권한 없으면 404) */
    BUDGET
}
