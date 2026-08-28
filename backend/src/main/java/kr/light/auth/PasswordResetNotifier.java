package kr.light.auth;

import kr.light.member.Member;

import java.time.Duration;

/**
 * 재설정 링크 발송 (SPEC_API.md §2.9).
 *
 * <p><b>⚠️ 이 토큰은 남의 계정 비밀번호를 바꿀 수 있는 값이다.</b> 구현체는
 * 본인 이메일 외 어디에도 흘려서는 안 된다 — 로그도 포함이다.
 *
 * <p>발송이 실패해도 토큰 발급은 유지된다. 사용자는 다시 요청하면 되고,
 * 그때 이전 토큰은 자동으로 닫힌다.
 */
public interface PasswordResetNotifier {

    /**
     * @param rawToken 평문 토큰. <b>이 순간에만 존재한다</b> — 서버는 해시만 갖는다
     * @param ttl      유효 기간. 메일 문구에 넣는다
     */
    void notifyResetRequested(Member member, String rawToken, Duration ttl);
}
