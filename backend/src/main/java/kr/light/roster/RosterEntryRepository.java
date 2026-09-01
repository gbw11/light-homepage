package kr.light.roster;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface RosterEntryRepository extends JpaRepository<RosterEntry, Long> {

    /**
     * 명단 대조 (SPEC_API.md §2.1) — 세 값이 전부 일치하는 행.
     *
     * <p><b>{@code Optional}이 아니라 {@code List}로 받는다.</b> DB의
     * {@code member_roster_person_uk}가 2건을 막고 있으므로 실제로는 0 또는
     * 1건이지만, §2.1은 "2건 이상 매칭 → 임원에게 문의" 분기를 요구한다.
     * {@code Optional}로 받으면 그 상황에서 예외가 터져 <b>500</b>이 나가고,
     * 사용자는 안내 대신 서버 오류를 본다. 제약이 언젠가 완화되더라도
     * 계약대로 동작하도록 여기서 여지를 남긴다.
     */
    List<RosterEntry> findByNameAndBirthDateAndPhoneNormalized(
            String name, LocalDate birthDate, String phoneNormalized);

    /** 출석부 대상 — active 명단 전원 (§13.1 rosterCount · §13.3 entries) */
    List<RosterEntry> findByActiveTrueOrderByNameAsc();

    long countByActiveTrue();

    Optional<RosterEntry> findByClaimedById(Long memberId);
}
