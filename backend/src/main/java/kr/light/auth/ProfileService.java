package kr.light.auth;

import kr.light.common.ApiException;
import kr.light.common.AuditAction;
import kr.light.common.AuditLogger;
import kr.light.common.Passwords;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import kr.light.member.Role;
import kr.light.roster.RosterEntry;
import kr.light.roster.RosterEntryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * 본인이 자기 계정에 하는 일 (SPEC_API.md §2.10 · §2.11 · §2.12).
 *
 * <p>전도사가 남에게 하는 일({@code MemberAdminService})과 나눠 둔다 —
 * 같은 "회원 수정"이지만 확인해야 하는 것이 다르다. 이쪽은 <b>본인이 맞는지</b>를
 * 다시 묻고, 저쪽은 <b>권한이 있는지</b>를 묻는다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProfileService {

    private final MemberRepository memberRepository;
    private final RosterEntryRepository rosterRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogger auditLogger;

    // ── 프로필 수정 (§2.10) ──────────────────────────────────────────

    /**
     * 연락처 변경.
     *
     * <p>⚠️ <b>명단의 전화번호는 바뀌지 않는다.</b> 명단은 교회의 기록이고
     * 계정의 연락처는 이 서비스에서 연락할 곳이다. 둘을 함께 바꾸면 §2.1
     * 명단 대조의 기준이 사용자가 고칠 수 있는 값이 되어버린다 — 그러면
     * 대조가 본인 확인 구실을 못 한다.
     *
     * <p>그래서 §8.2에서 전도사가 본인 확인 전화를 걸 때는 <b>명단의</b>
     * 번호를 쓴다. 그쪽은 사용자가 바꿀 수 없다.
     */
    @Transactional
    public MeResponse updatePhone(Long memberId, String phone) {
        Member member = find(memberId);
        member.changePhone(phone.trim());
        return MeResponse.of(member);
    }

    // ── 비밀번호 변경 (§2.11) ────────────────────────────────────────

    /**
     * 비밀번호 변경.
     *
     * <p>현재 비밀번호를 다시 묻는다 — 로그인해 있다는 것만으로는 부족하다.
     * 자리를 비운 사이 남이 브라우저를 만지면 비밀번호를 바꿔 계정을 통째로
     * 가져갈 수 있다.
     *
     * <p><b>다른 기기의 세션을 전부 끊는다.</b> 비밀번호를 바꾸는 이유가
     * "누가 내 계정을 쓰는 것 같다"인 경우가 많은데, 기존 세션을 살려두면
     * 정작 그 사람은 그대로 남는다.
     *
     * <p>⚠️ 이 기기의 세션도 함께 끊긴다. 호출한 쪽이 새 쿠키를 발급해
     * 로그인 상태를 이어주어야 한다 ({@code AuthController}).
     */
    @Transactional
    public Member changePassword(Long memberId, String currentPassword, String newPassword,
                                 Instant now) {
        Member member = find(memberId);

        // 카카오 전용 계정에는 바꿀 비밀번호가 없다. 여기서 만들어 주지도
        // 않는다 — 그러면 loginId 없이 비밀번호만 있는 계정이 생겨
        // 로그인할 방법이 없는 상태가 된다 (§2.3은 loginId로 찾는다).
        requirePasswordAccount(member);
        assertPasswordMatches(currentPassword, member);

        Passwords.assertWithinBcryptLimit(newPassword);
        member.changePassword(passwordEncoder.encode(newPassword));
        refreshTokenRepository.revokeAllFor(member, now);

        log.info("비밀번호 변경: member={}", member.getId());
        return member;
    }

    // ── 탈퇴 (§2.12) ─────────────────────────────────────────────────

    /**
     * 회원 탈퇴 — <b>회원 행을 삭제한다.</b> 개인정보 즉시 파기(NFR-PRIV-06).
     *
     * <p><b>명단은 다시 열린다.</b> 탈퇴는 "이 서비스를 그만 쓴다"이지
     * "교회를 떠난다"가 아니다 — 마음이 바뀌면 다시 가입할 수 있어야 한다.
     * 명단 행 자체는 교회의 기록이라 지우지 않는다.
     *
     * <p>⚠️ {@code password}는 비밀번호가 있는 계정에만 요구한다. 카카오로
     * 가입했다면 확인할 비밀번호가 없고, 필수로 두면 <b>그 사람들은 탈퇴할
     * 수 없다</b> — 로그인 세션 자체를 본인 확인으로 본다.
     */
    @Transactional
    public void withdraw(Long memberId, String password, Instant now) {
        Member member = find(memberId);

        if (member.hasPasswordLogin()) {
            assertPasswordMatches(password, member);
        }

        // ⚠️ 마지막 전도사는 탈퇴할 수 없다. 나가고 나면 아무도 회원을
        //    관리할 수 없고, 되돌리려면 DB를 직접 만져야 한다.
        //    역할 변경(§8.3)·계정 삭제(§8.2)의 자기잠금 방지와 같은 규칙이다.
        if (member.getRole() == Role.PASTOR && memberRepository.countByRole(Role.PASTOR) <= 1) {
            throw ApiException.validation("role",
                    "마지막 전도사는 탈퇴할 수 없습니다. 다른 전도사를 세운 뒤 진행해 주세요.");
        }

        // ★ actor를 null로 남긴다 — 본인 탈퇴는 <행위자 자신이 사라지는> 동작이라
        //   actor로 참조할 대상이 없다. 지울 엔티티를 actor로 넘기면 커밋 시점에
        //   TransientObjectException이 난다(이미 삭제된 것을 참조하게 되므로).
        //   어차피 FK가 ON DELETE SET NULL이라 남겨도 곧 null이 될 값이다.
        //   누가 나갔는지는 target에 남는다.
        auditLogger.log(null, AuditAction.MEMBER_WITHDRAW,
                "member:" + member.getId(), "본인 탈퇴 (" + member.getName() + ")");

        // DB의 ON DELETE SET NULL이 claimed_by를 풀어 주지만, claimed_at까지
        // 정리해 "가입한 적 있는 행"으로 읽히지 않게 한다 (§8.2와 같다).
        rosterRepository.findByClaimedById(member.getId()).ifPresent(RosterEntry::release);

        // 리프레시 토큰은 FK CASCADE로 함께 지워진다. 액세스 토큰은 서버에
        // 상태가 없어 만료(30분)까지 살아 있지만, 그 토큰으로 할 수 있는 일은
        // 없다 — 모든 보호 경로가 회원 행을 다시 읽는다.
        memberRepository.delete(member);
        log.info("회원 탈퇴: member={}", memberId);
    }

    // ── 보조 ─────────────────────────────────────────────────────────

    private Member find(Long memberId) {
        // 토큰은 유효한데 회원이 없다 = 탈퇴 후 토큰이 남은 경우
        return memberRepository.findById(memberId).orElseThrow(ApiException::unauthorized);
    }

    private void requirePasswordAccount(Member member) {
        if (!member.hasPasswordLogin()) {
            throw ApiException.validation("currentPassword",
                    "카카오로 가입한 계정에는 비밀번호가 없습니다.");
        }
    }

    /**
     * ⚠️ {@code UNAUTHORIZED}가 아니라 {@code VALIDATION_ERROR}다.
     *
     * <p>401을 주면 FE의 공통 처리가 "세션이 끊겼다"로 보고 로그인 화면으로
     * 튕긴다. 실제로는 <b>로그인은 멀쩡하고 입력한 비밀번호만 틀린</b>
     * 상황이라, 사용자는 왜 튕겼는지 알 수 없게 된다.
     */
    private void assertPasswordMatches(String rawPassword, Member member) {
        if (rawPassword == null || !passwordEncoder.matches(rawPassword, member.getPasswordHash())) {
            throw ApiException.validation("password", "비밀번호가 올바르지 않습니다.");
        }
    }
}
