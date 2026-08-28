package kr.light.common;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;

/**
 * 권한 거부를 어떤 에러 코드로 내보낼지 한곳에서 정한다.
 *
 * <p><b>왜 따로 두는가.</b> 같은 "권한 부족"이 <b>두 경로</b>로 나간다.
 * <ul>
 *   <li>필터 체인 — {@code SecurityConfig}의 {@code AccessDeniedHandler}.
 *       경로 규칙({@code authorizeHttpRequests})에서 걸린 경우</li>
 *   <li>어드바이스 — {@link GlobalExceptionHandler}. {@code @PreAuthorize}가
 *       컨트롤러 호출 중에 던진 경우. 이건 필터보다 <b>먼저</b> 잡힌다</li>
 * </ul>
 * 두 곳이 서로 다른 코드를 내보내면 FE는 같은 상황에서 다른 화면을 띄운다.
 * 실제로 그렇게 어긋난 적이 있어 여기로 합쳤다.
 *
 * <p>권한 이름 문자열을 보고 판단한다 — {@code kr.light.auth}의 주체 타입에
 * 기대지 않으려는 것이다. 인증 방식이 바뀌어도 {@code ROLE_} 규약만 지키면
 * 이 판단은 그대로 유효하다.
 */
public final class AuthorizationFailures {

    private static final String PENDING_AUTHORITY = "ROLE_" + kr.light.member.Role.PENDING.name();

    private AuthorizationFailures() {
    }

    /**
     * 거부 상황에 맞는 에러 코드.
     *
     * <p><b>승인 대기 회원은 {@code FORBIDDEN}이 아니라 {@code PENDING_APPROVAL}이다.</b>
     * 둘 다 403이지만 FE의 행동이 다르다 — {@code PENDING_APPROVAL}을 받으면
     * "어느 화면에 있든 {@code /pending}으로" 보낸다 (SPEC_API.md §12.3).
     * {@code FORBIDDEN}만 주면 미승인 회원은 "권한 없음" 안내만 보고 자기가
     * <b>승인을 기다리는 중</b>이라는 사실을 알 방법이 없다.
     */
    public static ErrorCode codeFor(Authentication authentication) {
        if (authentication == null || authentication.getAuthorities() == null) {
            return ErrorCode.FORBIDDEN;
        }
        boolean pending = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(PENDING_AUTHORITY::equals);

        return pending ? ErrorCode.PENDING_APPROVAL : ErrorCode.FORBIDDEN;
    }
}
