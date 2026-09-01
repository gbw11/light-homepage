package kr.light.auth;

/**
 * 카카오 서버와 이야기하는 부분 (SPEC_API.md §2.7 · §2.8).
 *
 * <p><b>인터페이스로 두는 이유는 테스트다.</b> 카카오를 실제로 부르는 테스트는
 * 만들 수 없다 — 네트워크가 필요하고, 매번 사람이 로그인해야 하며, CI에서는
 * 아예 불가능하다. 그런데 <b>정작 확인해야 하는 것은 카카오가 아니라
 * 우리 쪽 분기</b>다: 기존 가입자인가, 증표가 유효한가, 명단이 아직 열려 있는가.
 * 그 분기를 테스트하려면 이 경계가 필요하다.
 */
public interface KakaoClient {

    /**
     * 인가 코드를 액세스 토큰으로 바꾼다.
     *
     * @throws KakaoException 코드가 만료·재사용됐거나 카카오가 거절한 경우
     */
    String exchangeCodeForAccessToken(String code);

    /**
     * 액세스 토큰으로 사용자 식별자를 얻는다.
     *
     * <p>⚠️ <b>이름·생년월일·전화번호는 받지 않는다.</b> 카카오는 비즈 앱
     * 전환 전에는 주지 않고, 준다 해도 쓰지 않는다 — 그 값들은 명단에서
     * 온다(§2.2). 여기서 필요한 것은 "같은 사람인지"를 가리는 id뿐이다.
     *
     * @throws KakaoException 토큰이 유효하지 않은 경우
     */
    String fetchUserId(String accessToken);
}
