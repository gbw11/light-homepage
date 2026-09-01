package kr.light.roster;

import kr.light.common.PhoneNumbers;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.Reader;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * 교회 명단 CSV 파서.
 *
 * <p><b>이 파일은 우리가 만든 형식이 아니다.</b> 교회에서 받은 엑셀을 저장한
 * 것이고, 열 이름·날짜 표기·인코딩이 매번 다를 수 있다. 그래서 엄격하게 읽고
 * 실패하는 대신 <b>최대한 읽고 문제를 전부 모아서 리포트한다</b> — 한 줄 때문에
 * 임포트가 통째로 멈추면 나머지 몇백 줄의 문제를 다음 실행에서야 알게 된다.
 *
 * <h2>⚠️ 인코딩</h2>
 * 한국어 Windows의 엑셀은 「CSV로 저장」의 기본이 <b>CP949(MS949)</b>다.
 * 이름이 깨진 채로 들어가면 §2.1 대조에서 100% 불일치하고, 그 사람은 명단에
 * 있는데도 가입하지 못한다.
 *
 * <p>다행히 {@code Files.newBufferedReader}의 디코더는 잘못된 바이트열을
 * <b>거부한다</b>({@code MalformedInputException}) — UTF-8·CP949 어느 방향으로
 * 어긋나도 깨진 채 들어가는 대신 임포트가 실패하고, {@code RosterImportRunner}가
 * 인코딩을 지목해 안내한다.
 *
 * <p>⚠️ 다만 그건 두 인코딩이 "거부할 줄 알아서" 성립한다. {@code ISO-8859-1}처럼
 * 모든 바이트를 받아들이는 값을 설정하면 조용히 깨지므로, 리포트가 이름 표본을
 * 찍어 사람이 눈으로 확인하게 한다.
 */
@Component
public class RosterCsvParser {

    /** UTF-8 BOM. 엑셀이 붙이며, 남겨두면 첫 열 이름이 못 읽히는 값이 된다 */
    private static final char BOM = '﻿';

    private static final Pattern DATE_SEPARATOR = Pattern.compile("[./\\s]+");
    private static final Pattern DIGITS_8 = Pattern.compile("\\d{8}");

    /** 이름 끝의 동명이인 접미사 — "김도연a"의 a */
    private static final Pattern SUFFIX = Pattern.compile("[a-z]$");

    private static final List<String> NAME_HEADERS =
            List.of("이름", "성명", "name");
    private static final List<String> BIRTH_HEADERS =
            List.of("생년월일", "생일", "birthdate", "birth_date", "birth");
    private static final List<String> PHONE_HEADERS =
            List.of("전화번호", "연락처", "휴대폰", "휴대전화", "핸드폰", "phone", "tel");
    private static final List<String> VILLAGE_HEADERS =
            List.of("마을", "village");

    public record Result(List<RosterCsvRow> rows, List<RosterProblem> problems) {
    }

    /** 필수 열의 위치. 하나라도 못 찾으면 읽기를 포기한다 */
    private record Columns(int name, int birth, int phone, int village) {
        boolean isComplete() {
            return name >= 0 && birth >= 0 && phone >= 0;
        }
    }

    public Result parse(Reader source) throws IOException {
        List<RosterCsvRow> rows = new ArrayList<>();
        List<RosterProblem> problems = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(source)) {
            String headerLine = nextMeaningfulLine(reader);
            if (headerLine == null) {
                problems.add(new RosterProblem(0, RosterProblem.Kind.MISSING_HEADER, "빈 파일"));
                return new Result(rows, problems);
            }

            List<String> headers = splitCsv(stripBom(headerLine));
            Columns columns = new Columns(
                    indexOf(headers, NAME_HEADERS),
                    indexOf(headers, BIRTH_HEADERS),
                    indexOf(headers, PHONE_HEADERS),
                    indexOf(headers, VILLAGE_HEADERS));

            if (!columns.isComplete()) {
                problems.add(new RosterProblem(1, RosterProblem.Kind.MISSING_HEADER,
                        "필수 열을 찾지 못했습니다. 읽은 헤더: " + headers
                                + " · 필요: 이름 · 생년월일 · 전화번호"));
                return new Result(rows, problems);
            }

            int line = 1;
            String raw;
            while ((raw = reader.readLine()) != null) {
                line++;
                if (raw.isBlank()) {
                    continue;
                }
                readRow(splitCsv(raw), line, columns, rows, problems);
            }
        }
        return new Result(rows, problems);
    }

    /** 한 줄 → 행 하나 또는 문제 하나. 둘 다 나오는 경우는 없다 */
    private void readRow(List<String> cells, int line, Columns columns,
                         List<RosterCsvRow> rows, List<RosterProblem> problems) {

        String name = cell(cells, columns.name());
        String birthRaw = cell(cells, columns.birth());
        String phoneRaw = cell(cells, columns.phone());

        List<String> missing = new ArrayList<>();
        if (name.isEmpty()) missing.add("이름");
        if (birthRaw.isEmpty()) missing.add("생년월일");
        if (phoneRaw.isEmpty()) missing.add("전화번호");
        if (!missing.isEmpty()) {
            problems.add(new RosterProblem(line, RosterProblem.Kind.MISSING_FIELD,
                    String.join("·", missing) + " 없음"));
            return;
        }

        LocalDate birthDate = parseBirthDate(birthRaw);
        if (birthDate == null) {
            problems.add(new RosterProblem(line, RosterProblem.Kind.BAD_BIRTH_DATE,
                    name + " — 읽지 못한 값: \"" + birthRaw + "\""));
            return;
        }

        String phoneNormalized = PhoneNumbers.normalize(phoneRaw);
        if (phoneNormalized == null) {
            problems.add(new RosterProblem(line, RosterProblem.Kind.BAD_PHONE,
                    name + " — " + PhoneNumbers.mask(phoneRaw)));
            return;
        }

        String village = columns.village() < 0 ? null : emptyToNull(cell(cells, columns.village()));
        rows.add(new RosterCsvRow(line, name, birthDate, phoneNormalized, phoneRaw, village));
    }

    /**
     * 생년월일 파싱 — 엑셀이 내보내는 표기를 최대한 받아들인다.
     *
     * <p>{@code 2001-03-14} · {@code 2001.03.14} · {@code 2001. 3. 14} ·
     * {@code 2001/3/14} · {@code 20010314}
     *
     * <p>⚠️ {@code 01-03-14}처럼 <b>연도가 두 자리인 표기는 받지 않는다.</b>
     * 1901년인지 2001년인지 알 방법이 없고, 여기서 잘못 찍으면 그 사람은 명단에
     * 있는데도 영영 가입하지 못한다 — 게다가 §2.1은 어느 필드가 틀렸는지
     * 알려주지 않으므로 본인은 원인을 알 수 없다. 리포트에 올려 사람이 고친다.
     */
    LocalDate parseBirthDate(String raw) {
        String v = raw.trim();
        if (DIGITS_8.matcher(v).matches()) {
            v = v.substring(0, 4) + "-" + v.substring(4, 6) + "-" + v.substring(6);
        } else {
            v = DATE_SEPARATOR.matcher(v).replaceAll("-");
        }

        String[] parts = v.split("-");
        if (parts.length != 3 || parts[0].length() != 4) {
            return null;
        }
        try {
            return LocalDate.of(
                    Integer.parseInt(parts[0]),
                    Integer.parseInt(parts[1]),
                    Integer.parseInt(parts[2]));
        } catch (NumberFormatException | DateTimeException e) {
            return null;
        }
    }

    // ── CSV 분해 ─────────────────────────────────────────────────────

    /**
     * 큰따옴표를 존중하는 분해.
     *
     * <p>이름에 쉼표가 들어갈 일은 없지만 주소·비고 열이 섞여 들어오면 그쪽에
     * 쉼표가 있고, 단순 {@code split(",")}은 그 지점부터 열이 하나씩 밀린다 —
     * <b>이 사고는 예외를 내지 않고 뒷열을 전부 조용히 어긋나게 한다.</b>
     */
    static List<String> splitCsv(String line) {
        List<String> cells = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean quoted = false;

        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (quoted) {
                if (c != '"') {
                    cur.append(c);
                } else if (i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    cur.append('"');      // "" 는 큰따옴표 한 글자
                    i++;
                } else {
                    quoted = false;
                }
            } else if (c == '"') {
                quoted = true;
            } else if (c == ',') {
                cells.add(cur.toString().trim());
                cur.setLength(0);
            } else {
                cur.append(c);
            }
        }
        cells.add(cur.toString().trim());
        return cells;
    }

    private static String stripBom(String s) {
        return !s.isEmpty() && s.charAt(0) == BOM ? s.substring(1) : s;
    }

    private static String nextMeaningfulLine(BufferedReader reader) throws IOException {
        String line;
        while ((line = reader.readLine()) != null) {
            if (!line.isBlank()) {
                return line;
            }
        }
        return null;
    }

    private static int indexOf(List<String> headers, List<String> aliases) {
        for (int i = 0; i < headers.size(); i++) {
            String h = headers.get(i).replace(" ", "").toLowerCase(Locale.ROOT);
            if (aliases.contains(h)) {
                return i;
            }
        }
        return -1;
    }

    private static String cell(List<String> cells, int idx) {
        return idx >= 0 && idx < cells.size() ? cells.get(idx).trim() : "";
    }

    private static String emptyToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }

    /** 이름에 동명이인 접미사가 붙어 있는가 */
    static boolean hasSuffix(String name) {
        return SUFFIX.matcher(name).find();
    }

    /**
     * 접미사를 뗀 이름 — <b>동명이인 묶음을 찾을 때만</b> 쓴다.
     * 저장·표시·대조에는 절대 쓰지 않는다 (SPEC_API §2.1).
     */
    static String baseName(String name) {
        return hasSuffix(name) ? name.substring(0, name.length() - 1) : name;
    }
}
