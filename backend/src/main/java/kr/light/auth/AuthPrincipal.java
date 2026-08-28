package kr.light.auth;

import kr.light.member.Role;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.Collection;
import java.util.List;

/**
 * 인증된 요청의 주체 — 액세스 토큰에서 꺼낸 것이 전부다.
 *
 * <p>회원 엔티티를 담지 않는다. 요청마다 DB를 읽지 않기 위해서이고, 이름·이메일
 * 같은 개인정보를 SecurityContext에 들고 다니지 않기 위해서다. 회원 정보가
 * 필요한 엔드포인트는 {@code memberId}로 직접 조회한다.
 */
public record AuthPrincipal(Long memberId, Role role) {

    /**
     * {@code ROLE_} 접두사를 붙인다. Spring Security의 {@code hasRole('LEADER')}가
     * 내부적으로 {@code ROLE_LEADER}를 찾기 때문이다. 접두사를 빼면 인가가
     * 조용히 전부 실패한다.
     */
    public Collection<? extends GrantedAuthority> authorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }
}
