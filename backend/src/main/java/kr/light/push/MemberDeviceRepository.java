package kr.light.push;

import kr.light.member.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface MemberDeviceRepository extends JpaRepository<MemberDevice, Long> {

    Optional<MemberDevice> findByToken(String token);

    /** 이 역할들 중 하나인 회원의 기기 토큰 — 회원 공지(전원) · 새가족(전도사 · 임원) */
    @Query("select d.token from MemberDevice d where d.member.role in :roles")
    List<String> findTokensByRoles(@Param("roles") Collection<Role> roles);

    /** 내 기기에서만 지운다 — 남의 토큰을 지울 수 없다 */
    @Modifying
    @Query("delete from MemberDevice d where d.token = :token and d.member.id = :memberId")
    int deleteMine(@Param("token") String token, @Param("memberId") Long memberId);

    /** FCM이 「없는 기기」라고 답한 토큰들 */
    @Modifying
    @Query("delete from MemberDevice d where d.token in :tokens")
    int deleteByTokens(@Param("tokens") Collection<String> tokens);
}
