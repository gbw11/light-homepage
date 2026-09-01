package kr.light.roster;

import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * 임포트 결과 — <b>이 리포트가 1단계의 실제 산출물이다.</b>
 *
 * <p>명단이 몇 줄 들어갔는지는 별로 중요하지 않다. 중요한 것은
 * <b>누가 가입하지 못하게 되는지</b>다. 명단 대조는 §2.1에 따라 실패 이유를
 * 알려주지 않으므로, 명단 쪽 문제는 사용자가 스스로 알아낼 방법이 없고
 * 전부 "명단에서 확인되지 않습니다"로만 보인다. 그래서 문제를 지금,
 * 사람이 고칠 수 있는 형태로 드러내는 것이 이 클래스의 목적이다.
 *
 * @param applied            실제로 DB에 반영했는지. false면 예행연습이다
 * @param namesSample        인코딩 눈으로 확인용 이름 표본 (CP949 사고 감지)
 */
public record RosterImportReport(
        boolean applied,
        int totalRows,
        int inserted,
        int updated,
        int missingFromCsv,
        int deactivated,
        List<RosterProblem> problems,
        List<String> namesSample
) {

    private static final int SAMPLE_SIZE = 5;
    private static final int MAX_LISTED_PER_KIND = 20;

    public static int sampleSize() {
        return SAMPLE_SIZE;
    }

    /** 가입을 실제로 막는 문제가 있는가 — 있으면 명단을 고치고 다시 돌려야 한다 */
    public boolean hasBlockingProblems() {
        return problems.stream().anyMatch(RosterProblem::blocksSignup);
    }

    /**
     * 사람이 읽는 리포트.
     *
     * <p>⚠️ 전화번호는 {@link kr.light.common.PhoneNumbers#mask}를 거쳐 들어온다.
     * 이 문자열은 로그로 남고 스크린샷으로 이슈에 붙는다.
     */
    public String render() {
        StringBuilder sb = new StringBuilder();
        sb.append("\n").append("═".repeat(70)).append("\n");
        sb.append("  명단 임포트 ").append(applied ? "완료" : "예행연습 (DB 미반영)").append("\n");
        sb.append("═".repeat(70)).append("\n");

        sb.append(String.format("  읽은 행 %d · 신규 %d · 갱신 %d%n", totalRows, inserted, updated));
        if (missingFromCsv > 0) {
            sb.append(String.format("  CSV에 없는 기존 행 %d%s%n", missingFromCsv,
                    deactivated > 0 ? " (비활성 처리 " + deactivated + ")" : " (그대로 둠)"));
        }

        sb.append("\n  이름 표본 — 깨져 보이면 인코딩이 틀렸습니다");
        sb.append(" (app.roster.import.charset)\n    ");
        sb.append(namesSample.isEmpty() ? "(없음)" : String.join(" · ", namesSample)).append("\n");

        if (problems.isEmpty()) {
            sb.append("\n  ✅ 문제 없음\n");
            sb.append("═".repeat(70)).append("\n");
            return sb.toString();
        }

        Map<RosterProblem.Kind, List<RosterProblem>> grouped = new TreeMap<>();
        for (RosterProblem p : problems) {
            grouped.computeIfAbsent(p.kind(), k -> new java.util.ArrayList<>()).add(p);
        }

        sb.append("\n  문제 ").append(problems.size()).append("건\n");
        grouped.forEach((kind, list) -> {
            sb.append(String.format("%n  ── %s (%d건)%s%n",
                    kind.label(), list.size(),
                    list.get(0).blocksSignup() ? "  ★ 고치지 않으면 가입이 막힙니다" : ""));
            list.stream().limit(MAX_LISTED_PER_KIND).forEach(p ->
                    sb.append(String.format("     %s %s%n",
                            p.line() > 0 ? p.line() + "행" : "파일", p.detail())));
            if (list.size() > MAX_LISTED_PER_KIND) {
                sb.append(String.format("     … 외 %d건%n", list.size() - MAX_LISTED_PER_KIND));
            }
        });

        if (hasBlockingProblems()) {
            sb.append("\n  ⚠️ ★ 표시된 문제는 해당 인원이 가입을 시도해도 ")
                    .append("\"명단에서 확인되지 않습니다\"만 보게 됩니다.\n")
                    .append("     본인은 원인을 알 수 없으므로 (SPEC_API §2.1) ")
                    .append("CSV를 고치고 다시 돌리세요.\n");
        }
        sb.append("═".repeat(70)).append("\n");
        return sb.toString();
    }
}
