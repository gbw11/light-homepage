package kr.light.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface OAuthStateRepository extends JpaRepository<OAuthState, Long> {

    /**
     * 해시로 찾는다. 평문은 서버에 없다.
     *
     * <p>{@code left join fetch}인 이유 — 증표는 <b>없을 수 있다</b>(로그인 경로).
     * 그냥 {@code join fetch}면 로그인 경로의 state가 조회되지 않아,
     * 기존 카카오 가입자가 아무리 시도해도 로그인이 안 된다.
     */
    @Query("select s from OAuthState s left join fetch s.registrationToken where s.stateHash = :hash")
    Optional<OAuthState> findByStateHash(@Param("hash") String hash);
}
