package kr.light.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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

    /**
     * 이 회원의 살아 있는 토큰을 전부 폐기한다 — <b>모든 기기에서 로그아웃</b>.
     *
     * <p>비밀번호 재설정에서 쓴다. 재설정하는 상황은 대개 계정이 남의 손에
     * 있을지도 모른다는 뜻이라, 기존 세션을 살려두면 비밀번호를 바꾼 의미가
     * 사라진다.
     *
     * <p>⚠️ 일반 로그아웃(§2.4)은 이걸 쓰지 않는다. 거기서 쓰면 다른 기기의
     * 로그인까지 끊겨 "이 브라우저에서 로그아웃"이라는 기대와 어긋난다.
     *
     * @return 폐기한 개수
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update RefreshToken t set t.revokedAt = :now
            where t.member = :member and t.revokedAt is null
            """)
    int revokeAllFor(@Param("member") kr.light.member.Member member, @Param("now") java.time.Instant now);
}
