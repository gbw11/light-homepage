package kr.light.auth;

import kr.light.roster.RosterEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface RegistrationTokenRepository extends JpaRepository<RegistrationToken, Long> {

    Optional<RegistrationToken> findByTokenHash(String tokenHash);

    /**
     * 같은 명단 행에 살아 있던 토큰을 전부 무효화한다.
     *
     * <p>대조를 다시 하면 이전 증표는 즉시 못 쓰게 된다 — 살아 있는 증표가
     * 항상 하나뿐이어야, 어딘가에 남은 옛 값으로 계정이 만들어지지 않는다.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update RegistrationToken t set t.usedAt = :now "
            + "where t.rosterEntry = :roster and t.usedAt is null")
    void invalidateAllFor(@Param("roster") RosterEntry roster, @Param("now") Instant now);
}
