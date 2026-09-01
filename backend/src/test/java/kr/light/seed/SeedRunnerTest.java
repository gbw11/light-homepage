package kr.light.seed;

import kr.light.member.Member;
import kr.light.member.MemberRepository;
import kr.light.member.Role;
import kr.light.roster.RosterEntry;
import kr.light.roster.RosterEntryRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 시드 계정 생성 규칙.
 *
 * <p><b>여기서 지키는 것은 기능이 아니라 사고 방지다.</b> 시드가 운영에서
 * 돌면 비밀번호를 아는 관리자 계정이 인터넷에 열려 있는 것과 같다
 * (ARCHITECTURE.md §13 배포 전 체크리스트).
 *
 * <p>Spring 컨텍스트를 띄우지 않는다 — {@code @Profile("local")} 때문에 test
 * 프로필에서는 빈이 아예 만들어지지 않아, 컨텍스트로는 이 클래스의 동작을
 * 볼 수가 없다. 대신 직접 조립해 규칙만 좁게 본다.
 */
class SeedRunnerTest {

    private final PasswordEncoder encoder = new BCryptPasswordEncoder();

    /** 저장된 회원. 각 테스트가 이 목록만 확인한다. */
    private final List<Member> saved = new ArrayList<>();
    private final List<RosterEntry> savedRoster = new ArrayList<>();

    // ── 운영 방지 ─────────────────────────────────────────────

    @Test
    @DisplayName("★ prod 프로필이 함께 켜져 있으면 기동을 중단한다")
    void prod에서는_기동을_막는다() {
        // @Profile("local")만으로는 local,prod처럼 둘 다 켠 실수를 막지 못한다.
        // 그 경우 빈이 만들어지고 운영 DB에 관리자 계정이 조용히 생긴다.
        var runner = runner(new SeedProperties(true, "비밀번호1234!"), "local", "prod");

        assertThatThrownBy(() -> runner.run(new DefaultApplicationArguments()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("prod");

        assertThat(saved).isEmpty();
    }

    @Test
    @DisplayName("prod가 없으면 정상 동작한다")
    void local만이면_만든다() {
        var runner = runner(new SeedProperties(true, "비밀번호1234!"), "local");

        assertThatCode(() -> runner.run(new DefaultApplicationArguments()))
                .doesNotThrowAnyException();

        assertThat(saved).hasSize(3);
    }

    // ── 비밀번호가 없으면 만들지 않는다 ────────────────────────

    @Test
    @DisplayName("비밀번호가 없으면 계정을 만들지 않는다 — 임의 기본값을 쓰지 않는다")
    void 비밀번호_없으면_만들지_않는다() {
        // 기본값으로 계정을 만들어 두는 편이 훨씬 위험하다.
        runner(new SeedProperties(true, null), "local").run(new DefaultApplicationArguments());
        assertThat(saved).isEmpty();

        runner(new SeedProperties(true, "   "), "local").run(new DefaultApplicationArguments());
        assertThat(saved).isEmpty();
    }

    @Test
    @DisplayName("enabled가 false면 만들지 않는다 — 켜는 것이 의도적이어야 한다")
    void 꺼져_있으면_만들지_않는다() {
        runner(new SeedProperties(false, "비밀번호1234!"), "local")
                .run(new DefaultApplicationArguments());

        assertThat(saved).isEmpty();
    }

    // ── 만들어지는 계정 ────────────────────────────────────────

    @Test
    @DisplayName("MEMBER·LEADER·PASTOR 각 1개가 승인된 상태로 생긴다")
    void 세_역할이_생긴다() {
        runner(new SeedProperties(true, "비밀번호1234!"), "local")
                .run(new DefaultApplicationArguments());

        assertThat(saved)
                .extracting(Member::getRole)
                .containsExactlyInAnyOrder(Role.PASTOR, Role.LEADER, Role.MEMBER);

        // ★ 계정마다 명단 행이 함께 생긴다. 계정만 만들면 실제 가입으로는
        //   도달할 수 없는 상태가 되어, 명단이 얽힌 기능을 개발할 수 없다.
        assertThat(savedRoster).hasSize(3);
        assertThat(saved).allSatisfy(m -> assertThat(m.getRosterEntry()).isNotNull());
    }

    @Test
    @DisplayName("비밀번호는 해시로 저장된다")
    void 비밀번호_해시() {
        String raw = "비밀번호1234!";
        runner(new SeedProperties(true, raw), "local").run(new DefaultApplicationArguments());

        assertThat(saved).allSatisfy(m -> {
            assertThat(m.getPasswordHash()).isNotEqualTo(raw);
            assertThat(encoder.matches(raw, m.getPasswordHash())).isTrue();
        });
    }

    @Test
    @DisplayName("★ 명백히 가짜인 생년월일을 쓴다 — 실제 교인의 것과 겹치면 안 된다")
    void 명단_값이_가짜다() {
        runner(new SeedProperties(true, "비밀번호1234!"), "local")
                .run(new DefaultApplicationArguments());

        assertThat(savedRoster).allSatisfy(entry -> {
            assertThat(entry.getBirthDate()).isEqualTo(java.time.LocalDate.of(1900, 1, 1));
            assertThat(entry.getPhoneDisplay()).startsWith("010-0000-");
        });
    }

    // ── 재실행 ────────────────────────────────────────────────

    @Test
    @DisplayName("이미 있으면 다시 만들지 않는다 — 재시작마다 unique 제약에 걸린다")
    void 멱등성() {
        var runner = runner(new SeedProperties(true, "비밀번호1234!"), "local");

        runner.run(new DefaultApplicationArguments());
        assertThat(saved).hasSize(3);

        runner.run(new DefaultApplicationArguments());
        assertThat(saved).hasSize(3);   // 늘지 않는다
    }

    @Test
    @DisplayName("이미 있는 계정의 비밀번호를 덮지 않는다")
    void 기존_비밀번호를_지키다() {
        var runner = runner(new SeedProperties(true, "처음비밀번호1!"), "local");
        runner.run(new DefaultApplicationArguments());
        String firstHash = saved.get(0).getPasswordHash();

        // 개발자가 비밀번호를 바꿔둔 상태에서 재시작하는 상황
        runner(new SeedProperties(true, "다른비밀번호2!"), "local")
                .run(new DefaultApplicationArguments());

        assertThat(saved.get(0).getPasswordHash()).isEqualTo(firstHash);
    }

    // ── 보조 ──────────────────────────────────────────────────

    private SeedRunner runner(SeedProperties properties, String... activeProfiles) {
        var environment = new MockEnvironment();
        environment.setActiveProfiles(activeProfiles);
        return new SeedRunner(fakeRepository(), fakeRosterRepository(), encoder, properties, environment);
    }

    /**
     * 저장만 기억하는 가짜 리포지토리.
     *
     * <p>{@code @DataJpaTest}를 쓰지 않는 이유는 이 테스트가 <b>DB 동작이 아니라
     * 생성 규칙</b>을 보기 때문이다. 진짜 DB를 붙이면 프로필·트랜잭션 설정이
     * 얽혀 정작 보려는 것이 흐려진다.
     */
    /** 저장만 기억하는 가짜 명단 리포지토리 */
    private RosterEntryRepository fakeRosterRepository() {
        RosterEntryRepository repository = mock(RosterEntryRepository.class);

        when(repository.save(any(RosterEntry.class)))
                .thenAnswer(call -> {
                    RosterEntry entry = call.getArgument(0);
                    savedRoster.add(entry);
                    return entry;
                });
        return repository;
    }

    private MemberRepository fakeRepository() {
        MemberRepository repository = mock(MemberRepository.class);

        when(repository.existsByLoginId(anyString()))
                .thenAnswer(call -> saved.stream()
                        .anyMatch(m -> call.getArgument(0).equals(m.getLoginId())));

        when(repository.save(any(Member.class)))
                .thenAnswer(call -> {
                    Member member = call.getArgument(0);
                    saved.add(member);
                    return member;
                });

        return repository;
    }
}
