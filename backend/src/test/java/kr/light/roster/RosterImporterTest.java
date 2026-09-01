package kr.light.roster;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import kr.light.member.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.io.IOException;
import java.io.StringReader;
import java.time.Instant;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 명단 임포트 (SPEC_API.md §2.1).
 *
 * <p>이 테스트가 지키는 것은 "몇 줄 들어갔는가"가 아니라
 * <b>"누가 가입하지 못하게 되는가"</b>다. 명단 대조는 실패 이유를 알려주지
 * 않으므로(§2.1), 명단 쪽 문제는 사용자가 스스로 알아낼 방법이 없다.
 */
@SpringBootTest
@ActiveProfiles("test")
class RosterImporterTest {

    @Autowired RosterImporter importer;
    @Autowired RosterEntryRepository rosterRepository;
    @Autowired MemberRepository memberRepository;

    @PersistenceContext EntityManager entityManager;

    private static final String HEADER = "이름,생년월일,전화번호,마을\n";

    @BeforeEach
    void clean() {
        rosterRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();
    }

    private RosterImportReport importCsv(String body, boolean apply) throws IOException {
        return importer.importFrom(new StringReader(HEADER + body), apply, false);
    }

    // ── 예행연습 ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("기본은 예행연습이다")
    class DryRun {

        @Test
        @DisplayName("apply=false면 리포트만 내고 DB에 쓰지 않는다")
        void 아무것도_쓰지_않는다() throws IOException {
            RosterImportReport report = importCsv("김도연,2001-03-14,010-1234-5678,1\n", false);

            assertThat(report.applied()).isFalse();
            assertThat(report.inserted()).isEqualTo(1);
            assertThat(rosterRepository.count()).isZero();
        }

        @Test
        @DisplayName("예행연습의 집계는 실제 반영과 같다 — 그래야 미리 보는 의미가 있다")
        void 집계가_실제와_같다() throws IOException {
            String body = "김도연,2001-03-14,010-1234-5678,1\n이서준,2002-05-06,010-2222-3333,2\n";

            RosterImportReport dry = importCsv(body, false);
            RosterImportReport real = importCsv(body, true);

            assertThat(dry.inserted()).isEqualTo(real.inserted());
            assertThat(dry.totalRows()).isEqualTo(real.totalRows());
            assertThat(rosterRepository.count()).isEqualTo(2);
        }
    }

    // ── 반영 ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("반영")
    class Apply {

        @Test
        void 신규_행을_넣는다() throws IOException {
            importCsv("김도연a,2001-03-14,010-1234-5678,1\n", true);

            assertThat(rosterRepository.findAll()).singleElement().satisfies(e -> {
                assertThat(e.getName()).isEqualTo("김도연a");     // 접미사 유지
                assertThat(e.getBirthDate()).isEqualTo(LocalDate.of(2001, 3, 14));
                assertThat(e.getPhoneNormalized()).isEqualTo("01012345678");
                assertThat(e.getPhoneDisplay()).isEqualTo("010-1234-5678");
                assertThat(e.getVillage()).isEqualTo("1");
                assertThat(e.isClaimable()).isTrue();
            });
        }

        @Test
        @DisplayName("두 번 돌려도 행이 늘지 않는다 — 멱등")
        void 멱등() throws IOException {
            String body = "김도연,2001-03-14,010-1234-5678,1\n";

            importCsv(body, true);
            RosterImportReport second = importCsv(body, true);

            assertThat(second.inserted()).isZero();
            assertThat(second.updated()).isEqualTo(1);
            assertThat(rosterRepository.count()).isEqualTo(1);
        }

        @Test
        @DisplayName("표기만 다른 같은 번호는 같은 사람이다")
        void 전화번호_표기가_달라도_같은_사람() throws IOException {
            importCsv("김도연,2001-03-14,010-1234-5678,1\n", true);
            RosterImportReport second = importCsv("김도연,2001-03-14,01012345678,1\n", true);

            assertThat(second.inserted()).isZero();
            assertThat(rosterRepository.count()).isEqualTo(1);
        }

        @Test
        @DisplayName("마을은 갱신되지만 이름·생년월일·전화번호는 식별자라 갱신 대상이 아니다")
        void 갱신_범위() throws IOException {
            importCsv("김도연,2001-03-14,010-1234-5678,1\n", true);
            importCsv("김도연,2001-03-14,010-1234-5678,3\n", true);

            assertThat(rosterRepository.findAll()).singleElement()
                    .extracting(RosterEntry::getVillage).isEqualTo("3");
        }
    }

    // ── 중복 ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("CSV 안의 중복은 첫 줄만 살리고 나머지를 리포트에 올린다")
    void CSV_내_중복() throws IOException {
        String body = """
                김도연,2001-03-14,010-1234-5678,1
                김도연,2001-03-14,010-1234-5678,1
                """;

        RosterImportReport report = importCsv(body, true);

        assertThat(report.inserted()).isEqualTo(1);
        assertThat(report.problems())
                .filteredOn(p -> p.kind() == RosterProblem.Kind.DUPLICATE_IN_CSV)
                .singleElement()
                .satisfies(p -> assertThat(p.detail()).contains("2행"));
        assertThat(rosterRepository.count()).isEqualTo(1);
    }

    // ── ★ 동명이인 접미사 ────────────────────────────────────────────

    @Nested
    @DisplayName("★ 동명이인 접미사 누락 — 리포트의 핵심")
    class SuffixSuspect {

        @Test
        @DisplayName("접미사 없는 동명이인이 있으면 가입을 막는 문제로 올린다")
        void 접미사가_빠지면_경고한다() throws IOException {
            String body = """
                    김도연,2001-03-14,010-1234-5678,1
                    김도연,2002-05-06,010-2222-3333,2
                    """;

            RosterImportReport report = importCsv(body, true);

            // 이 두 사람은 가입 화면에 무엇을 쳐야 할지 알 수 없다.
            // §2.1은 "사용자는 자기 알파벳을 안다"를 전제하는데, 명단이
            // 그 알파벳을 부여하지 않은 상태다.
            assertThat(report.hasBlockingProblems()).isTrue();
            assertThat(report.problems())
                    .filteredOn(p -> p.kind() == RosterProblem.Kind.SUFFIX_SUSPECT)
                    .singleElement()
                    .satisfies(p -> assertThat(p.detail()).contains("김도연", "2명"));
        }

        @Test
        @DisplayName("일부만 접미사가 있어도 잡는다 — 가장 흔한 실수다")
        void 일부만_붙은_경우() throws IOException {
            String body = """
                    김도연a,2001-03-14,010-1234-5678,1
                    김도연,2002-05-06,010-2222-3333,2
                    """;

            assertThat(importCsv(body, true).hasBlockingProblems()).isTrue();
        }

        @Test
        @DisplayName("전원 접미사가 붙어 있으면 정상이다")
        void 전원_붙어_있으면_통과() throws IOException {
            String body = """
                    김도연a,2001-03-14,010-1234-5678,1
                    김도연b,2002-05-06,010-2222-3333,2
                    """;

            RosterImportReport report = importCsv(body, true);

            assertThat(report.hasBlockingProblems()).isFalse();
            assertThat(rosterRepository.count()).isEqualTo(2);
        }

        @Test
        @DisplayName("동명이인이 아닌 사람은 접미사가 없어도 경고하지 않는다")
        void 오탐이_없다() throws IOException {
            String body = """
                    김도연,2001-03-14,010-1234-5678,1
                    이서준,2002-05-06,010-2222-3333,2
                    """;

            assertThat(importCsv(body, true).problems()).isEmpty();
        }
    }

    // ── CSV에 없는 행 ────────────────────────────────────────────────

    @Nested
    @DisplayName("CSV에 없는 기존 행")
    class MissingFromCsv {

        @Test
        @DisplayName("기본은 그대로 둔다 — 일부만 담긴 CSV로 전원이 사라지면 안 된다")
        void 자동으로_지우지_않는다() throws IOException {
            importCsv("김도연,2001-03-14,010-1234-5678,1\n이서준,2002-05-06,010-2222-3333,2\n", true);

            RosterImportReport report = importCsv("김도연,2001-03-14,010-1234-5678,1\n", true);

            assertThat(report.missingFromCsv()).isEqualTo(1);
            assertThat(report.deactivated()).isZero();
            assertThat(rosterRepository.countByActiveTrue()).isEqualTo(2);
        }

        @Test
        @DisplayName("명시적으로 켜야 비활성 처리한다 — 삭제는 하지 않는다")
        void 켜면_비활성_처리() throws IOException {
            importCsv("김도연,2001-03-14,010-1234-5678,1\n이서준,2002-05-06,010-2222-3333,2\n", true);

            RosterImportReport report = importer.importFrom(
                    new StringReader(HEADER + "김도연,2001-03-14,010-1234-5678,1\n"), true, true);

            assertThat(report.deactivated()).isEqualTo(1);
            // 지우지 않는다 — 지우면 그 사람의 출석 기록이 대상을 잃는다
            assertThat(rosterRepository.count()).isEqualTo(2);
            assertThat(rosterRepository.countByActiveTrue()).isEqualTo(1);
        }

        @Test
        @DisplayName("이미 비활성인 행은 매번 다시 보고하지 않는다 — 옛 잡음이 새 문제를 묻는다")
        void 비활성_행은_다시_보고하지_않는다() throws IOException {
            importCsv("김도연,2001-03-14,010-1234-5678,1\n이서준,2002-05-06,010-2222-3333,2\n", true);
            importer.importFrom(
                    new StringReader(HEADER + "김도연,2001-03-14,010-1234-5678,1\n"), true, true);

            RosterImportReport third = importCsv("김도연,2001-03-14,010-1234-5678,1\n", true);

            assertThat(third.missingFromCsv()).isZero();
        }
    }

    // ── 명단 재개방 ──────────────────────────────────────────────────

    @Test
    @DisplayName("★ 계정을 지우면 명단이 저절로 다시 열린다 (SPEC_API §8.2 · §2.12)")
    void 계정_삭제가_명단을_재개방한다() throws IOException {
        importCsv("김도연,2001-03-14,010-1234-5678,1\n", true);
        RosterEntry entry = rosterRepository.findAll().get(0);

        Member member = memberRepository.save(Member.builder()
                .loginId("claim")
                .name("김도연")
                .role(Role.MEMBER)
                .build());
        entry.claimBy(member, Instant.now());
        rosterRepository.saveAndFlush(entry);
        assertThat(rosterRepository.findAll().get(0).isClaimable()).isFalse();

        memberRepository.delete(member);
        memberRepository.flush();

        // 1차 캐시를 비우고 DB에서 다시 읽는다 — 비우지 않으면 방금 손댄
        // 엔티티가 그대로 돌아와 DB가 무엇을 했는지 확인하지 못한다
        entityManager.clear();

        // ⚠️ 애플리케이션이 해제를 잊어도 DB의 ON DELETE SET NULL이 열어준다.
        //    잠긴 채로 남으면 진짜 본인이 두 번 다시 가입할 수 없다 —
        //    §8.2 선점 복구 절차가 존재하는 이유가 사라진다.
        assertThat(rosterRepository.findById(entry.getId()))
                .get()
                .satisfies(e -> assertThat(e.isClaimable()).isTrue());
    }
}
