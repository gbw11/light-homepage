package kr.light.auth;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * 카카오 로그인의 state (SPEC_API.md §2.7).
 *
 * <p>OAuth의 state는 원래 CSRF 방어값이다. 우리는 역할을 하나 더 준다 —
 * 가입 경로에서 {@link RegistrationToken}을 콜백까지 실어 나른다.
 *
 * <p>★ 그런데 증표를 state에 <b>직접 넣지 않는다.</b> state는 인가 URL에
 * 그대로 노출되는데(주소창·리퍼러·브라우저 기록), 증표는 그것만 있으면
 * 남의 이름으로 계정을 만들 수 있는 값이다. 무의미한 난수를 발급하고
 * 여기서 되찾는다.
 */
@Entity
@Table(name = "oauth_states")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class OAuthState {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** ★ SHA-256. 평문은 인가 URL에만 존재한다 */
    @Column(name = "state_hash", nullable = false, length = 255)
    private String stateHash;

    /** 가입 경로면 채워진다. 기존 카카오 가입자의 로그인이면 null */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "registration_token_id")
    private RegistrationToken registrationToken;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "used_at")
    private Instant usedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public boolean isUsable(Instant now) {
        return usedAt == null && expiresAt.isAfter(now);
    }

    public void markUsed(Instant at) {
        this.usedAt = at;
    }
}
