package kr.light.auth;

import java.security.SecureRandom;
import java.util.Locale;

/**
 * 비밀번호 리셋 코드 (SPEC_API.md §8.4 → §2.9).
 *
 * <h2>이 값은 사람이 입으로 전한다</h2>
 * 전도사가 화면에서 읽어 전화나 문자로 알려주고, 본인이 손으로 옮겨 친다.
 * 그래서 <b>헷갈리는 글자를 아예 만들지 않는다</b> — {@code 0}과 {@code O},
 * {@code 1}과 {@code I}·{@code L}은 말로도 글자로도 구별되지 않아서, 넣어두면
 * "코드가 안 맞는다"는 문의가 그만큼 생긴다. 그리고 §2.9는 실패 이유를
 * 알려주지 않으므로 본인은 무엇이 틀렸는지 알 수 없다.
 *
 * <p>{@code XXXX-XXXX} 네 자리씩 끊는 것도 같은 이유다 — 여덟 글자를 통으로
 * 부르면 받아적다 자리를 잃는다.
 *
 * <h2>추측할 수 있는 값인가</h2>
 * 31글자 8자리 = 약 {@code 8.5 × 10^11}가지(≈40비트)다. 코드만으로는 쓸 수
 * 없고 <b>아이디까지 맞아야</b> 하며, 30분이 지나면 사라지고 1회용이다.
 * 온라인으로 맞혀 볼 수 있는 규모가 아니다.
 *
 * <p>⚠️ 그래도 <b>서버는 해시만 갖는다</b>. 평문을 저장하면 DB를 읽을 수 있는
 * 사람이 남의 비밀번호를 바꿀 수 있다 ({@link kr.light.common.SecureTokens}).
 */
public final class ResetCodes {

    /**
     * 0·O·1·I·L을 뺀 31글자.
     *
     * <p>⚠️ 글자를 더 빼면 자릿수를 늘려야 한다 — 짧고 헷갈리지 않는 것과
     * 추측하기 어려운 것은 맞바꾸는 관계다.
     */
    private static final String ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

    private static final int GROUP_SIZE = 4;
    private static final int GROUPS = 2;
    private static final char SEPARATOR = '-';

    private static final SecureRandom RANDOM = new SecureRandom();

    private ResetCodes() {
    }

    /** {@code 8H2K-9QX1} 형태의 평문 코드. 이 순간에만 존재한다 */
    public static String generate() {
        StringBuilder code = new StringBuilder();
        for (int group = 0; group < GROUPS; group++) {
            if (group > 0) {
                code.append(SEPARATOR);
            }
            for (int i = 0; i < GROUP_SIZE; i++) {
                code.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
            }
        }
        return code.toString();
    }

    /**
     * 사용자가 친 값을 대조할 수 있는 형태로 되돌린다.
     *
     * <p>소문자로 치거나, 하이픈을 빼거나, 공백을 넣는 것은 <b>전부 맞게
     * 친 것으로 본다.</b> 입으로 전달받은 값을 옮겨 적는 상황이라 표기가
     * 흔들리는 것이 정상이고, 그걸 틀렸다고 하면 사용자는 이유도 모른 채
     * 막힌다 (§2.9는 실패 이유를 구분해 주지 않는다).
     */
    public static String normalize(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
    }
}
