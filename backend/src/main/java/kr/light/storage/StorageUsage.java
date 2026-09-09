package kr.light.storage;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 저장 용량 사용량 (SPEC_API.md §8.5).
 *
 * <p>⚠️ 계약이 정한 필드만 담는다. R2 연산 횟수는 여기 싣지 않는다 —
 * §8.5에 없는 필드를 넣으면 FE 타입과 어긋난다({@link R2OperationCounter}의
 * 값은 로그와 DB로만 본다).
 *
 * <p>{@code usedBytes}·{@code limitBytes}는 <b>숫자로</b> 내보낸다. 문자열
 * 직렬화 규칙은 ID에만 적용된다 (§1.3).
 */
@Schema(description = "저장 용량 사용량 (SPEC_API §8.5)")
public record StorageUsage(

        @Schema(description = "쓰고 있는 바이트 — 사진첩 + 첨부·주보 + 월례회 문서의 합", example = "4509715660")
        long usedBytes,

        @Schema(description = "무료 한도 바이트 (R2 Standard 10GB)", example = "10737418240")
        long limitBytes,

        @Schema(description = "사용률 %. 소수 한 자리", example = "42.0")
        double usagePercent,

        @Schema(description = "커밋된 사진 장수", example = "3100")
        long photoCount,

        @Schema(description = "차단 지점까지 더 올릴 수 있는 사진 장수(추정)", example = "4300")
        long estimatedRemainingPhotos,

        @Schema(description = "경고 시작 %", example = "80")
        int warningThreshold,

        @Schema(description = "업로드 차단 %", example = "95")
        int blockThreshold,

        @Schema(description = "지금 업로드가 막혀 있는가", example = "false")
        boolean uploadBlocked
) {
}
