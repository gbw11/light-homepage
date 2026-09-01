package kr.light.common;

import java.util.regex.Pattern;

/**
 * 전화번호 정규화 — <b>명단 대조의 성패가 여기 달려 있다</b> (SPEC_API.md §2.1).
 *
 * <p>명단 CSV의 표기와 사용자가 가입 화면에 치는 표기가 같을 이유가 없다.
 * 같은 번호가 이렇게 들어온다:
 *
 * <pre>
 *   010-1234-5678 · 01012345678 · 010 1234 5678 · +82-10-1234-5678
 * </pre>
 *
 * 원문끼리 비교하면 <b>본인인데도 "명단에서 확인되지 않습니다"가 뜬다.</b>
 * 그리고 §2.1은 어느 필드가 틀렸는지 알려주지 않기로 했으므로, 사용자는
 * 무엇을 고쳐야 하는지 영영 알 수 없다. 그래서 양쪽 다 이 함수를 통과시킨다.
 */
public final class PhoneNumbers {

    private static final Pattern NON_DIGIT = Pattern.compile("\\D");

    /** 국가번호 표기를 국내 표기로 되돌린다: {@code +82 10 ...} → {@code 010 ...} */
    private static final String KR_COUNTRY_CODE = "82";

    /**
     * 유효하다고 볼 최소 자릿수.
     *
     * <p>휴대폰 11자리·지역번호 10자리가 정상이고, 그보다 짧으면 잘린 값이다.
     * 9로 둔 것은 {@code 02-123-4567}(9자리) 같은 옛 서울 번호를 살리기 위해서다.
     */
    private static final int MIN_DIGITS = 9;

    private static final int MAX_DIGITS = 15;

    private PhoneNumbers() {
    }

    /**
     * 대조에 쓸 형태로 정규화한다.
     *
     * @return 숫자만 남긴 문자열. 값이 없거나 자릿수가 말이 안 되면 {@code null}
     */
    public static String normalize(String raw) {
        if (raw == null) {
            return null;
        }
        String digits = NON_DIGIT.matcher(raw).replaceAll("");

        // "+82 10 1234 5678" → "821012345678" → "01012345678"
        // ⚠️ 앞의 0을 빼고 82를 붙이는 것이 국제 표기 규칙이므로, 되돌릴 때
        //    0을 다시 붙여야 국내 표기와 같아진다. 82만 떼면 "1012345678"이
        //    되어 "01012345678"과 영영 만나지 않는다.
        if (digits.startsWith(KR_COUNTRY_CODE) && digits.length() > KR_COUNTRY_CODE.length() + 1) {
            digits = "0" + digits.substring(KR_COUNTRY_CODE.length());
        }

        if (digits.length() < MIN_DIGITS || digits.length() > MAX_DIGITS) {
            return null;
        }
        return digits;
    }

    /**
     * 로그·리포트에 실을 가림 표기: {@code 01012345678} → {@code 010****5678}.
     *
     * <p>임포트 리포트는 개발자 화면에 뜨지만, 그 화면은 스크린샷으로 이슈에
     * 붙고 로그 파일로 남는다. 어느 행이 문제인지 알아보기에는 앞 3자리와
     * 뒤 4자리로 충분하다.
     */
    public static String mask(String raw) {
        String digits = raw == null ? "" : NON_DIGIT.matcher(raw).replaceAll("");
        if (digits.length() < 7) {
            return "***";
        }
        return digits.substring(0, 3) + "****" + digits.substring(digits.length() - 4);
    }
}
