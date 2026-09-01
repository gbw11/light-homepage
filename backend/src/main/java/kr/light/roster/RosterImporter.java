package kr.light.roster;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.Reader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 명단 CSV → {@code member_roster} 반영 (SPEC_API.md §2.1).
 *
 * <h2>기본은 예행연습이다</h2>
 * {@code apply=false}면 아무것도 쓰지 않고 리포트만 낸다. 명단은 사람의
 * 개인정보이고, 잘못 넣으면 <b>그 사람이 가입하지 못한다.</b> 먼저 보고
 * 확인한 뒤 반영하는 순서가 기본값이어야 한다.
 *
 * <h2>세 값이 사람의 식별자다</h2>
 * {@code (이름, 생년월일, 전화번호)}가 같으면 같은 사람으로 본다 — DB의
 * {@code member_roster_person_uk}, §2.1의 대조 조건과 같은 세 값이다.
 * 셋 중 하나라도 바뀌면 <b>다른 사람</b>이므로 갱신이 아니라 신규 행이 된다.
 * (전화번호가 실제로 바뀐 경우는 옛 행이 "CSV에 없음"으로 리포트에 올라온다)
 */
@Service
@RequiredArgsConstructor
public class RosterImporter {

    private final RosterCsvParser parser;
    private final RosterEntryRepository repository;

    /**
     * @param apply             true면 DB에 반영한다. false는 예행연습
     * @param deactivateMissing CSV에 없는 기존 행을 비활성 처리할지.
     *                          <b>기본 false</b> — 명단 일부만 담긴 CSV를 실수로
     *                          넣으면 나머지 전원이 출석부에서 사라진다
     */
    @Transactional
    public RosterImportReport importFrom(Reader source, boolean apply, boolean deactivateMissing)
            throws IOException {

        RosterCsvParser.Result parsed = parser.parse(source);
        List<RosterProblem> problems = new ArrayList<>(parsed.problems());

        Map<RosterCsvRow.PersonKey, RosterCsvRow> unique = dedupe(parsed.rows(), problems);
        flagSuffixSuspects(unique.values(), problems);

        Map<RosterCsvRow.PersonKey, RosterEntry> existing = existingByKey();

        int inserted = 0;
        int updated = 0;
        for (Map.Entry<RosterCsvRow.PersonKey, RosterCsvRow> e : unique.entrySet()) {
            RosterEntry found = existing.get(e.getKey());
            if (found == null) {
                if (apply) {
                    repository.save(toEntity(e.getValue()));
                }
                inserted++;
            } else {
                if (apply) {
                    found.refresh(e.getValue().phoneDisplay(), e.getValue().village());
                }
                updated++;
            }
        }

        int deactivated = 0;
        List<RosterEntry> missing = missingFromCsv(existing, unique.keySet());
        for (RosterEntry entry : missing) {
            problems.add(new RosterProblem(0, RosterProblem.Kind.MISSING_FROM_CSV,
                    entry.getName() + " — " + (deactivateMissing ? "비활성 처리" : "그대로 둠")));
            if (deactivateMissing) {
                if (apply) {
                    entry.deactivate();
                }
                deactivated++;
            }
        }

        return new RosterImportReport(apply, parsed.rows().size(), inserted, updated,
                missing.size(), deactivated, problems, sampleNames(unique.values()));
    }

    // ── 중복 ─────────────────────────────────────────────────────────

    /** CSV 안에서 같은 사람이 두 번 나오면 첫 줄만 살리고 나머지를 리포트에 올린다 */
    private Map<RosterCsvRow.PersonKey, RosterCsvRow> dedupe(
            List<RosterCsvRow> rows, List<RosterProblem> problems) {

        Map<RosterCsvRow.PersonKey, RosterCsvRow> unique = new LinkedHashMap<>();
        for (RosterCsvRow row : rows) {
            RosterCsvRow first = unique.putIfAbsent(row.key(), row);
            if (first != null) {
                problems.add(new RosterProblem(row.line(), RosterProblem.Kind.DUPLICATE_IN_CSV,
                        row.name() + " — " + first.line() + "행과 같은 사람 (이 행은 건너뜁니다)"));
            }
        }
        return unique;
    }

    /**
     * ★ 동명이인 접미사 누락 점검 — <b>리포트의 핵심</b>.
     *
     * <p>접미사를 뗀 이름이 같은 사람이 둘 이상인데 그중 접미사가 없는 행이
     * 있으면, 그 사람은 가입 화면에 무엇을 쳐야 할지 알 수 없다. §2.1은
     * "사용자는 자기 알파벳을 안다"를 전제로 하는데, 명단이 그 알파벳을
     * 부여하지 않은 상태이기 때문이다.
     *
     * <p>여기서 잡지 않으면 그 사람은 가입을 시도할 때마다
     * "명단에서 확인되지 않습니다"만 보게 되고, 왜인지 알 수 없다.
     */
    private void flagSuffixSuspects(
            Iterable<RosterCsvRow> rows, List<RosterProblem> problems) {

        Map<String, List<RosterCsvRow>> byBaseName = new LinkedHashMap<>();
        for (RosterCsvRow row : rows) {
            byBaseName.computeIfAbsent(RosterCsvParser.baseName(row.name()), k -> new ArrayList<>())
                    .add(row);
        }

        byBaseName.forEach((base, group) -> {
            if (group.size() < 2) {
                return;
            }
            List<RosterCsvRow> bare = group.stream()
                    .filter(r -> !RosterCsvParser.hasSuffix(r.name()))
                    .toList();
            if (bare.isEmpty()) {
                return;     // 전원 접미사 있음 — 정상
            }
            String lines = bare.stream().map(r -> r.line() + "행").toList().toString();
            problems.add(new RosterProblem(bare.get(0).line(), RosterProblem.Kind.SUFFIX_SUSPECT,
                    "\"" + base + "\" " + group.size() + "명 중 " + bare.size()
                            + "명에게 접미사가 없습니다 " + lines
                            + " — 이 인원은 가입 시 입력할 이름을 알 수 없습니다"));
        });
    }

    // ── DB 쪽 ────────────────────────────────────────────────────────

    private Map<RosterCsvRow.PersonKey, RosterEntry> existingByKey() {
        Map<RosterCsvRow.PersonKey, RosterEntry> map = new HashMap<>();
        for (RosterEntry entry : repository.findAll()) {
            map.put(new RosterCsvRow.PersonKey(
                    entry.getName(), entry.getBirthDate(), entry.getPhoneNormalized()), entry);
        }
        return map;
    }

    /**
     * DB에는 active로 있는데 이번 CSV에 없는 행.
     *
     * <p>이미 비활성인 행은 세지 않는다 — 지난번에 처리한 것을 매번 다시
     * 보고하면 리포트가 옛 잡음으로 채워져 <b>진짜 새 문제가 묻힌다.</b>
     */
    private List<RosterEntry> missingFromCsv(
            Map<RosterCsvRow.PersonKey, RosterEntry> existing,
            Set<RosterCsvRow.PersonKey> inCsv) {

        Set<RosterCsvRow.PersonKey> keys = new HashSet<>(existing.keySet());
        keys.removeAll(inCsv);
        return keys.stream()
                .map(existing::get)
                .filter(RosterEntry::isActive)
                .toList();
    }

    private RosterEntry toEntity(RosterCsvRow row) {
        return RosterEntry.builder()
                .name(row.name())
                .birthDate(row.birthDate())
                .phoneNormalized(row.phoneNormalized())
                .phoneDisplay(row.phoneDisplay())
                .village(row.village())
                .active(true)
                .build();
    }

    /** 인코딩 사고(CP949를 UTF-8로 읽기)를 사람이 눈으로 잡게 하는 표본 */
    private List<String> sampleNames(Iterable<RosterCsvRow> rows) {
        List<String> sample = new ArrayList<>();
        for (RosterCsvRow row : rows) {
            if (sample.size() >= RosterImportReport.sampleSize()) {
                break;
            }
            sample.add(row.name());
        }
        return sample;
    }
}
