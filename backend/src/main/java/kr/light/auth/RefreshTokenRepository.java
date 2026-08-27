package kr.light.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    /**
     * 해시로 찾는다. 평문은 서버에 없다.
     *
     * <p>{@code join fetch member} — 회전할 때 곧바로 회원의 액세스 토큰을 다시
     * 발급해야 하는데, LAZY로 두면 {@code open-in-view: false}라 여기서 못 꺼낸다.
     */
    @Query("select t from RefreshToken t join fetch t.member where t.tokenHash = :hash")
    Optional<RefreshToken> findByTokenHash(@Param("hash") String hash);
}
