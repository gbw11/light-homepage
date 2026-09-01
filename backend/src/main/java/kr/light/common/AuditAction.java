package kr.light.common;

/**
 * 감사 로그에 남기는 행위.
 *
 * <p>DB에는 문자열로 저장된다(varchar(50)). 오타로 조회가 어긋나는 것을 막기
 * 위해 열거형으로 좁혀둔다. 필요한 행위가 생기면 여기에 추가한다.
 */
public enum AuditAction {
    /** 회원 승인 — PENDING → MEMBER */
    /** 회원 가입 거절 */
    /**
     * 계정 삭제 + 명단 재개방 (SPEC_API.md §8.2).
     *
     * <p>선점 복구 절차의 기록이다 — 회원 행이 사라지므로 <b>사유가 담긴
     * 이 로그가 유일한 기록</b>이다.
     */
    MEMBER_DELETE,
    /** 역할 부여·변경 */
    ROLE_CHANGE
}
