package kr.light.common;

import java.nio.charset.StandardCharsets;

/**
 * 비밀번호 값의 한계 — <b>BCrypt는 72바이트까지만 받는다.</b>
 *
 * <h2>왜 문자 수로 막으면 안 되는가</h2>
 * Bean Validation의 {@code @Size(max = 72)}는 <b>문자 수</b>를 센다. 그런데
 * BCrypt의 한계는 <b>바이트 수</b>이고, UTF-8에서 한글은 한 글자가 3바이트다.
 * 그래서 한글 25자짜리 비밀번호(75바이트)는 {@code @Size}를 통과한 뒤
 * {@code BCryptPasswordEncoder}에서 예외가 나 <b>500</b>이 된다.
 *
 * <p>사용자 입장에서는 "아무 설명 없이 서버 오류"이고, 한국어 사용자만 겪는다 —
 * 영문으로 테스트하면 끝까지 드러나지 않는다. (실제로 실서버 확인에서 잡혔다.)
 *
 * <p>그래서 비밀번호를 받는 모든 곳(§2.2 가입 · §2.9 재설정 · §2.11 변경)이
 * 이 검사를 거쳐야 한다.
 */
public final class Passwords {

    /** BCrypt가 받는 최대 바이트 수. 이보다 길면 인코더가 예외를 던진다 */
    public static final int MAX_BYTES = 72;

    private Passwords() {
    }

    /**
     * @throws ApiException 72바이트를 넘으면 {@code VALIDATION_ERROR(field=password)}
     */
    public static void assertWithinBcryptLimit(String rawPassword) {
        if (rawPassword == null) {
            return;     // 비어 있는 것은 @NotBlank가 잡는다
        }
        if (rawPassword.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES) {
            // 바이트 수를 안내해도 사용자는 무슨 말인지 알 수 없다. 한글 기준
            // 대략적인 글자 수로 말해 준다.
            throw ApiException.validation("password",
                    "비밀번호가 너무 깁니다. 한글은 24자, 영문·숫자는 72자까지 가능합니다.");
        }
    }
}
