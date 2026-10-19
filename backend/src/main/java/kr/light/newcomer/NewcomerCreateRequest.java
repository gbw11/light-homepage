package kr.light.newcomer;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 새가족 등록 요청 (SPEC_API.md §9.1).
 *
 * <p>공개 폼이므로 누구나 보낼 수 있다. 그래서 개인정보 동의와 스팸 방지가
 * 이 엔드포인트의 핵심이다.
 *
 * <p><b>⚠️ {@code agreed}는 여기서 검증하지 않는다.</b> 빈 검증(Bean Validation)은
 * 바인딩 시점에 돌아 {@code honeypot} 검사보다 먼저 터진다. 그러면 봇이 400을
 * 받으면서 "무엇이 틀렸는지" 알게 된다. 동의 검증은 honeypot 다음에
 * {@link NewcomerService}가 한다.
 */
@Schema(name = "NewcomerCreateRequest", description = "새가족 등록 요청")
public record NewcomerCreateRequest(

        @Schema(description = "실명", example = "김도연", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "이름을 입력해주세요.")
        @Size(max = 50, message = "이름이 너무 깁니다.")
        String name,

        @Schema(description = "연락처", example = "010-1234-5678",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "연락처를 입력해주세요.")
        @Size(max = 20, message = "연락처가 너무 깁니다.")
        String phone,

        @Schema(nullable = true, example = "MALE")
        Gender gender,

        /**
         * 생년월일 — 2026-10-19 나이대(ageGroup)를 대체했다 (§9.1 [CONTRACT]).
         *
         * <p>가입 명단 확인({@code VerifyRosterRequest})과 같은 모양으로 문자열로
         * 받는다. {@code LocalDate}로 받으면 형식이 틀렸을 때 "본문을 읽을 수 없다"는
         * 필드 없는 오류가 나서, 폼이 어느 칸이 틀렸는지 짚어주지 못한다.
         * 달력에 없는 날짜·미래 날짜는 {@link NewcomerService}가 거른다.
         */
        @Schema(description = "생년월일 (YYYY-MM-DD)", example = "2001-03-14",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "생년월일을 입력해주세요.")
        @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}",
                message = "생년월일은 YYYY-MM-DD 형식입니다.")
        String birthDate,

        @Schema(description = "알게 된 경로", nullable = true, example = "FRIEND")
        Referrer referrer,

        @Schema(description = "하고 싶은 말", nullable = true,
                example = "친구 소개로 가보려고요")
        @Size(max = 2000, message = "내용이 너무 깁니다.")
        String message,

        @Schema(description = "개인정보 수집 동의. **true가 아니면 거부한다.**",
                example = "true", requiredMode = Schema.RequiredMode.REQUIRED)
        Boolean agreed,

        /**
         * 스팸 방지용 미끼 필드.
         *
         * <p>화면에서는 감춰져 있어 사람은 채울 수 없다. 값이 들어오면 봇으로 보고
         * <b>조용히 204</b>를 준다 — 거부당했다는 사실을 알려주면 봇이 우회를
         * 시도한다 (SPEC_API.md §9.1 · WIREFRAME.md §10).
         */
        @Schema(description = "비워 두세요. 봇 판별용 미끼 필드입니다.",
                nullable = true, example = "")
        String honeypot
) {

    boolean looksLikeBot() {
        return honeypot != null && !honeypot.isBlank();
    }

    boolean agreedToPrivacyPolicy() {
        return Boolean.TRUE.equals(agreed);
    }
}
