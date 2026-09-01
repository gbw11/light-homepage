package kr.light.seed;

import kr.light.common.PhoneNumbers;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import kr.light.member.Role;
import kr.light.roster.RosterEntry;
import kr.light.roster.RosterEntryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * 개발용 시드 계정 — MEMBER · LEADER · PASTOR 각 1개
 * (BACKEND_TASKS.md §10 M2 · ARCHITECTURE.md §14).
 *
 * <p><b>왜 필요한가.</b> 최초 전도사는 API로 만들 수 없다 — 역할 부여는
 * {@code MEMBER ↔ LEADER}만 허용하기 때문이다(FR-ADM-04). 시드가 없으면
 * 승인 기능 하나를 확인하려 해도 가입 → DB 직접 수정 → 로그인 → 승인 순서를
 * 매번 손으로 밟아야 하고, DB를 날리면 처음부터 다시다.
 *
 * <p>FE에게도 필요하다. mock에서 실제 백엔드로 전환할 때 로그인할 계정이
 * 있어야 한다 (INTEGRATION.md §7 통합 체크포인트).
 *
 * <h2>⚠️ 운영에서 절대 돌면 안 된다</h2>
 *
 * 비밀번호를 아는 관리자 계정이 인터넷에 열려 있는 것과 같다. 세 겹으로 막는다.
 * <ol>
 *   <li>{@code @Profile("local")} — prod·test 프로필에서는 빈이 아예 만들어지지 않는다</li>
 *   <li>{@link #abortIfProduction} — 그럼에도 prod가 함께 켜져 있으면 <b>기동을 중단</b>한다.
 *       프로필을 여러 개 켜는 실수({@code local,prod})를 잡기 위한 것이다</li>
 *   <li>{@code app.seed.enabled}가 기본 false — 켜는 것이 의도적인 행동이어야 한다</li>
 * </ol>
 *
 * <p>비밀번호는 코드에 없다. {@code application-local.yml}(gitignore됨)이나
 * {@code SEED_PASSWORD} 환경변수로 준다. 없으면 만들지 않고 안내만 남긴다.
 *
 * <p><b>배포 전 체크리스트에 "시드 계정 비밀번호 변경 또는 삭제"가 있다</b>
 * (ARCHITECTURE.md §13 · SPEC_NONFUNCTIONAL.md). 운영 이관 시 반드시 처리할 것.
 */
@Slf4j
@Component
@Profile("local")
@RequiredArgsConstructor
public class SeedRunner implements ApplicationRunner {

    private final MemberRepository memberRepository;
    private final RosterEntryRepository rosterRepository;
    private final PasswordEncoder passwordEncoder;
    private final SeedProperties properties;
    private final Environment environment;

    /**
     * 만들 계정.
     *
     * <p>⚠️ <b>명단 행도 함께 만든다.</b> v1.3에서 계정은 "명단에서 확인된
     * 사람"을 뜻하므로, 명단 없이 계정만 만들면 실제 가입으로는 도달할 수 없는
     * 상태가 된다 — 그런 시드로 개발하면 §8.2 계정 삭제·명단 재개방 같은
     * 기능이 손에 잡히지 않는다.
     *
     * <p>생년월일·전화번호는 명백히 가짜인 값을 쓴다. 진짜처럼 보이는 값을
     * 넣으면 실제 교인의 것과 겹칠 수 있다.
     */
    /** 명백히 가짜인 값. 실제 교인의 생일과 겹치지 않게 한다 */
    private static final LocalDate SEED_BIRTH_DATE = LocalDate.of(1900, 1, 1);

    private static final List<SeedAccount> ACCOUNTS = List.of(
            new SeedAccount("시드전도사", "pastor", Role.PASTOR, "1", "010-0000-0001"),
            new SeedAccount("시드임원", "leader", Role.LEADER, "2", "010-0000-0002"),
            new SeedAccount("시드회원", "member", Role.MEMBER, "3", "010-0000-0003")
    );

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        abortIfProduction();

        if (!properties.isUsable()) {
            logHowToEnable();
            return;
        }

        List<String> created = ACCOUNTS.stream()
                .filter(this::createIfAbsent)
                .map(SeedAccount::loginId)
                .toList();

        if (created.isEmpty()) {
            log.info("시드 계정이 이미 있다. 새로 만들지 않았다.");
        } else {
            // ⚠️ 비밀번호는 찍지 않는다. 설정한 사람이 이미 아는 값이고,
            //    로그로 새면 시드를 파일에서 뺀 의미가 없다.
            log.warn("⚠️ 개발용 시드 계정을 만들었다 (운영에 두지 말 것): {}", created);
        }
    }

    /**
     * 이미 있으면 만들지 않는다.
     *
     * <p>앱을 재시작할 때마다 중복 생성되면 unique 제약에 걸려 기동이 실패한다.
     * 그리고 <b>이미 있는 계정의 비밀번호를 덮지도 않는다</b> — 개발자가
     * 바꿔둔 값을 되돌리면 혼란스럽다.
     *
     * @return 새로 만들었으면 true
     */
    private boolean createIfAbsent(SeedAccount account) {
        if (memberRepository.existsByLoginId(account.loginId())) {
            return false;
        }

        RosterEntry roster = rosterRepository.save(RosterEntry.builder()
                .name(account.name())
                .birthDate(SEED_BIRTH_DATE)
                .phoneNormalized(PhoneNumbers.normalize(account.phone()))
                .phoneDisplay(account.phone())
                .village(account.village())
                .active(true)
                .build());

        Member member = Member.registerFromRoster(
                roster, account.loginId(), passwordEncoder.encode(properties.password()));

        // 가입은 MEMBER로 시작한다. 임원·전도사 시드는 여기서 올린다.
        if (account.role() != Role.MEMBER) {
            promote(member, account.role());
        }
        memberRepository.save(member);
        roster.claimBy(member, Instant.now());
        return true;
    }

    /**
     * 시드 계정을 목표 역할까지 올린다.
     *
     * <p>{@code changeRole()}은 {@code MEMBER ↔ LEADER}만 허용한다 —
     * <b>사람이 하는 동작</b>의 규칙이고, PASTOR를 API로 열지 않기 위한 것이다.
     * 시드는 그 규칙의 대상이 아니므로 여기서만 리플렉션으로 직접 심는다.
     * 도메인 규칙을 시드 때문에 느슨하게 만들지 않기 위해서다.
     *
     * <p>★ 최초 전도사는 이 경로로만 만들 수 있다 — API에는 PASTOR를 주는
     * 방법이 없다.
     */
    private void promote(Member member, Role role) {
        setField(member, "role", role);
    }

    private void setField(Object target, String name, Object value) {
        try {
            var field = target.getClass().getDeclaredField(name);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException("시드 계정 역할 설정 실패: " + name, e);
        }
    }

    /**
     * prod 프로필이 함께 켜져 있으면 기동을 중단한다.
     *
     * <p>{@code @Profile("local")}만으로도 prod 단독 실행에서는 빈이 만들어지지
     * 않는다. 이 검사는 <b>{@code local,prod}처럼 둘 다 켠 실수</b>를 잡는다 —
     * 그 경우 빈은 만들어지고, 조용히 관리자 계정이 운영 DB에 생긴다.
     *
     * <p>경고 로그가 아니라 기동 중단인 이유: 로그는 아무도 안 본다.
     */
    private void abortIfProduction() {
        boolean prodActive = List.of(environment.getActiveProfiles()).contains("prod");
        if (prodActive) {
            throw new IllegalStateException(
                    "prod 프로필에서 시드가 활성화됐다. 운영 DB에 개발용 계정이 생길 뻔했다. "
                            + "활성 프로필: " + String.join(",", environment.getActiveProfiles()));
        }
    }

    private void logHowToEnable() {
        log.info("""
                시드 계정을 만들지 않았다 (app.seed.enabled={}, 비밀번호 {}).
                  쓰려면 application-local.yml에 넣을 것 — 이 파일은 gitignore 대상이다:
                    app:
                      seed:
                        enabled: true
                        password: <원하는 비밀번호>
                  아이디: pastor · leader · member""",
                properties.enabled(),
                properties.password() == null || properties.password().isBlank() ? "없음" : "있음");
    }

    /** @param village 마을은 서로 다르게 둔다 — 마을별 화면을 확인할 수 있게 */
    private record SeedAccount(String name, String loginId, Role role, String village, String phone) {
    }
}
