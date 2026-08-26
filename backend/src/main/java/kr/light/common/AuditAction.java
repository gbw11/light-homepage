package kr.light.common;

/**
 * 감사 로그에 남기는 행위.
 *
 * <p>DB에는 문자열로 저장된다(varchar(50)). 오타로 조회가 어긋나는 것을 막기
 * 위해 열거형으로 좁혀둔다. 필요한 행위가 생기면 여기에 추가한다.
 */
public enum AuditAction {
    /** 회원 승인 — PENDING → MEMBER */
    MEMBER_APPROVE,
    /** 회원 가입 거절 */
    MEMBER_REJECT,
    /** 역할 부여·변경 */
    ROLE_CHANGE
}
