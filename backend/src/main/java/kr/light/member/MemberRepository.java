package kr.light.member;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MemberRepository extends JpaRepository<Member, Long> {

    Optional<Member> findByLoginId(String loginId);

    boolean existsByLoginId(String loginId);

    /**
     * 관리 화면의 회원 목록 — 이름 부분 검색 (SPEC_API.md §8.1).
     *
     * <p>⚠️ <b>JPQL로 {@code (:q is null or ...)} 형태를 쓰지 않는다.</b>
     * Postgres에서 null 문자열 파라미터가 {@code bytea}로 넘어가
     * {@code function lower(bytea) does not exist}로 500이 난다. 조건을 파라미터로
     * 켜고 끄는 대신, <b>검색어가 없으면 빈 문자열</b>을 넘겨 항상 같은 쿼리를 탄다
     * ({@code like '%%'}는 전체와 일치).
     *
     * <p>대소문자를 구분하지 않는다 — 한글에는 의미가 없지만 영문 이름이 섞일 수
     * 있고, 구분하면 "kim"으로 "Kim"을 못 찾는다.
     */
    Page<Member> findByNameContainingIgnoreCase(String name, Pageable pageable);

    /**
     * 자기잠금 방지용 (ARCHITECTURE.md §5.4).
     *
     * <p>마지막 PASTOR가 사라지면 아무도 회원을 승인할 수 없다. RLS가 없으므로
     * 이 검사는 애플리케이션 책임이다.
     */
    long countByRole(Role role);
}
