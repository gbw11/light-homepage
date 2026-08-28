package kr.light.member;

/**
 * 역할 계층 — 계단식(상위가 하위를 포함).
 * Spring Security의 RoleHierarchy로 ROLE_MEMBER &lt; ROLE_LEADER &lt; ROLE_PASTOR를
 * 선언하면 @PreAuthorize("hasRole('LEADER')") 하나로 상위 역할까지 통과한다.
 *
 * @see <a href="file:../../../../../../../docs/spec/ARCHITECTURE.md">ARCHITECTURE.md §5.1</a>
 */
public enum Role {
    /** 가입했으나 미승인. 회원 API 전부 차단 */
    PENDING,
    /** 승인된 회원 — 주보·사진첩·내부 공지·월례회(기간 내) */
    MEMBER,
    /** 임원 — + 콘텐츠 작성/삭제, 회의록, 예산안, 월례회(기간 무관) */
    LEADER,
    /** 전도사 — + 회원 승인·역할 부여 */
    PASTOR
}
