package kr.light.common;

import jakarta.servlet.http.HttpServletRequest;

/**
 * 요청자 IP — 시도 제한의 기준값.
 *
 * <p>Render가 앞단에서 프록시하므로 {@code getRemoteAddr()}는 프록시 주소다.
 * {@code X-Forwarded-For}의 <b>맨 앞</b> 값이 원래 클라이언트다.
 *
 * <h2>⚠️ 이 값은 위조할 수 있다</h2>
 * 마음먹은 공격자는 매 요청 다른 값을 넣어 제한을 우회한다. 그래도 쓰는 이유는,
 * IP 제한의 목적이 "작정한 공격 차단"이 아니라 <b>"무심코 여러 번 누르는 것과
 * 단순 봇을 걸러내는 것"</b>이기 때문이다.
 *
 * <p>그래서 <b>이 값에 기대는 제한을 유일한 방어선으로 두지 않는다.</b> 명단
 * 대조(SPEC_API.md §2.1)에는 이 제한 위에 "실패 이유를 알려주지 않는다"가 있고,
 * 로그인(§2.3)에는 아이디 단위 잠금이 따로 있다. 더 강한 방어가 필요해지면
 * CAPTCHA나 프록시 단 제한으로 올린다.
 */
public final class ClientAddress {

    private static final String FORWARDED_FOR = "X-Forwarded-For";
    private static final String UNKNOWN = "unknown";

    private ClientAddress() {
    }

    public static String of(HttpServletRequest request) {
        String forwarded = request.getHeader(FORWARDED_FOR);
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        String remote = request.getRemoteAddr();
        return remote != null ? remote : UNKNOWN;
    }
}
