package kr.light.auth;

import kr.light.member.Member;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    /**
     * 해시로 찾는다. 평문은 서버에 없다.
     *
     * <p>{@code join fetch member} — 찾자마자 그 회원의 비밀번호를 바꿔야 하는데
     * LAZY로 두면 {@code open-in-view: false}라 꺼낼 수 없다.
     */
    @Query("select t from PasswordResetToken t join fetch t.member where t.tokenHash = :hash")
    Optional<PasswordResetToken> findByTokenHash(@Param("hash") String hash);

    /**
     * 이 회원의 아직 쓰지 않은 토큰을 전부 사용 처리한다.
     *
     * <p>재설정을 여러 번 요청하면 메일이 여러 통 간다. 그중 <b>가장 최근 것
     * 하나만</b> 살아 있어야 한다 — 오래된 링크가 계속 유효하면 지난 메일을
     * 손에 넣은 사람이 나중에 쓸 수 있다.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update PasswordResetToken t set t.usedAt = :now
            where t.member = :member and t.usedAt is null
            """)
    int invalidateAllFor(@Param("member") Member member, @Param("now") Instant now);
}
