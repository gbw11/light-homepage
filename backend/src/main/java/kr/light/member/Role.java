package kr.light.member;

/**
 * 역할 계층 — 계단식(상위가 하위를 포함).
 * Spring Security의 RoleHierarchy로 ROLE_MEMBER &lt; ROLE_LEADER &lt; ROLE_PASTOR를
 * 선언하면 @PreAuthorize("hasRole('LEADER')") 하나로 상위 역할까지 통과한다.
 *
 * <p>⚠️ <b>{@code PENDING}은 v1.3(2026-08-31)에서 사라졌다.</b> 명단 대조가
 * 본인 확인을 대신하므로 승인 절차가 없고, 가입하면 즉시 {@link #MEMBER}다
 * (SPEC_API.md §2.2 · §9-B 확정). {@code ErrorCode.PENDING_APPROVAL}도 함께
 * 폐기됐다.
 *
 * @see <a href="file:../../../../../../../docs/spec/ARCHITECTURE.md">ARCHITECTURE.md §5.1</a>
 */
public enum Role {
    /** 회원 — 주보·사진첩·내부 공지·회의록·월례회(기간 내) */
    MEMBER,
    /** 임원 — + 콘텐츠 작성/삭제, 예산안, 월례회(기간 무관), 출석부 */
    LEADER,
    /** 전도사 — + 계정 삭제·명단 재개방, 역할 부여, 비밀번호 리셋 코드 */
    PASTOR
}
