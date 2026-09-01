package kr.light.admin;

import kr.light.common.ApiException;
import kr.light.common.AuditAction;
import kr.light.common.AuditLogger;
import kr.light.common.PageResponse;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import kr.light.roster.RosterEntry;
import kr.light.roster.RosterEntryRepository;
import kr.light.member.Role;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * 회원 승인·거절·역할 부여 (SPEC_API.md §8.1~§8.4).
 *
 * <p>전부 전도사(PASTOR) 전용이고 되돌리기 어려운 동작이라, <b>세 가지를
 * 항상 함께</b> 한다 — 상태 변경 · 감사로그 · 자기잠금 검사.
 *
 * <p><b>⚠️ 권한 검사는 여기서 하지 않는다.</b> 컨트롤러의
 * {@code @PreAuthorize("hasRole('PASTOR')")}가 1층이다. 이 클래스는 "전도사가
 * 부른 것"을 전제로 <b>도메인 규칙</b>만 본다 (ARCHITECTURE.md §5.2 2층 방어).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MemberAdminService {

    private final MemberRepository memberRepository;
    private final RosterEntryRepository rosterRepository;
    private final AuditLogger auditLogger;

    /** SPEC_API.md §1.6 — 기본 20, 최대 100 */
    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    // ── 조회 ──────────────────────────────────────────────────

    /**
     * 회원 목록 (SPEC_API.md §8.1).
     *
     * <p>~~{@code status} 파라미터~~ 는 v1.3에서 폐기됐다 — 승인 절차가 없어
     * {@code PENDING}이 존재하지 않으므로 목록은 하나뿐이다.
     *
     * @param q 이름 부분 검색. 비어 있으면 전체
     */
    @Transactional(readOnly = true)
    public PageResponse<MemberSummaryResponse> list(String q, int page, int size) {
        // 정렬은 가입일 최신순으로 고정한다 — 호출자가 정렬을 바꾸지 못하게 둔다.
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        // 검색어가 없으면 빈 문자열 — null을 넘기면 Postgres에서 lower(bytea)로 깨진다
        String name = (q == null) ? "" : q.trim();

        return PageResponse.of(
                memberRepository.findByNameContainingIgnoreCase(name, pageable),
                MemberSummaryResponse::of);
    }

    // ── 계정 삭제 · 명단 재개방 ────────────────────────────────

    /**
     * 계정 삭제 + 명단 재개방 (SPEC_API.md §8.2) — <b>회원 행을 삭제한다.</b>
     *
     * <h2>이것이 선점 복구 절차다</h2>
     * 진짜 본인이 가입하려는데 "명단에서 확인되지 않습니다"가 뜨는 경우가
     * 있다 — 누군가 그 명단 행으로 이미 계정을 만든 것이다(§2.1은 그 사실을
     * 알려주지 않으므로 본인은 이유를 모른다). 전도사가 명단의 전화번호로
     * 본인을 확인한 뒤 이 API로 계정을 지우면, 명단이 다시 열려 본인이
     * 가입할 수 있다.
     *
     * <p><b>⚠️ 그래서 감사로그의 사유가 유일한 기록이다.</b> 회원 행이 사라지므로
     * 로그를 먼저 남기고 지운다 — 순서가 바뀌면 로그의 대상 id가 이미 없는 행을
     * 가리키게 된다(같은 트랜잭션이라 실제로는 함께 커밋되지만, 읽는 사람에게
     * 의도가 드러나야 한다).
     *
     * <p>명단 해제는 DB의 {@code ON DELETE SET NULL}이 이미 보장한다. 그래도
     * 여기서 명시적으로 푸는 이유는 {@code claimed_at}까지 정리하기 위해서다 —
     * 판단에는 쓰이지 않지만, 남아 있으면 "가입한 적 있는 행"으로 읽힌다.
     */
    @Transactional
    public void delete(Long memberId, Member actor, String reason) {
        Member member = find(memberId);

        // ⚠️ 자기 계정은 지울 수 없다. 마지막 전도사가 자신을 지우면 아무도
        //    회원을 관리할 수 없다 — 역할 변경의 자기잠금 방지와 같은 이유다.
        if (member.getId().equals(actor.getId())) {
            throw ApiException.validation("id", "자기 계정은 삭제할 수 없습니다.");
        }

        auditLogger.log(actor, AuditAction.MEMBER_DELETE, target(member), reason);

        rosterRepository.findByClaimedById(member.getId()).ifPresent(RosterEntry::release);
        memberRepository.delete(member);
    }

    // ── 역할 변경 ─────────────────────────────────────────────

    /**
     * 역할 변경 (SPEC_API.md §8.4) — {@code MEMBER ↔ LEADER}만.
     *
     * <p><b>⚠️ 자기잠금 방지 (ARCHITECTURE.md §5.4 · FR-ADM-05).</b> 마지막
     * PASTOR가 강등되면 아무도 회원을 승인할 수 없다. 지금은 API가 PASTOR를
     * 다루지 않아 이 경로로는 일어나지 않지만, <b>검사는 남겨둔다</b> — 나중에
     * PASTOR 부여를 열거나 탈퇴(§2.13)를 붙일 때 이 규칙이 이미 여기 있어야 한다.
     */
    @Transactional
    public void changeRole(Long memberId, Role newRole, Member actor) {
        Member member = find(memberId);
        Role previous = member.getRole();

        assertKeepsAtLeastOnePastor(member, newRole);

        try {
            member.changeRole(newRole);
        } catch (IllegalStateException e) {
            throw ApiException.validation("role", "MEMBER 또는 LEADER로만 변경할 수 있습니다.");
        }

        auditLogger.log(actor, AuditAction.ROLE_CHANGE, target(member),
                "%s → %s".formatted(previous, newRole));
    }

    /**
     * 이 변경으로 PASTOR가 0이 되지 않는가.
     *
     * <p>RLS가 없으므로 애플리케이션이 막는 수밖에 없다. 막지 못하면 복구
     * 방법은 DB 직접 수정뿐이다.
     */
    private void assertKeepsAtLeastOnePastor(Member member, Role newRole) {
        boolean losingPastor = member.getRole() == Role.PASTOR && newRole != Role.PASTOR;
        if (losingPastor && memberRepository.countByRole(Role.PASTOR) <= 1) {
            throw ApiException.validation("role",
                    "마지막 전도사는 강등할 수 없습니다. 다른 전도사를 먼저 지정해주세요.");
        }
    }

    // ── 보조 ──────────────────────────────────────────────────

    private Member find(Long memberId) {
        return memberRepository.findById(memberId).orElseThrow(ApiException::notFound);
    }

    /** 감사로그의 대상 식별자. {@code "member:51"} 형태 */
    private String target(Member member) {
        return "member:" + member.getId();
    }

    static int normalizeSize(Integer size) {
        if (size == null || size < 1) {
            return DEFAULT_SIZE;
        }
        return Math.min(size, MAX_SIZE);
    }

    static int normalizePage(Integer page) {
        return (page == null || page < 0) ? 0 : page;
    }
}
