package kr.light.newcomer;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

/**
 * 새가족 신청 한 건 (SPEC_API.md §8.6).
 *
 * <p>⚠️ <b>개인정보다.</b> 이름과 전화번호가 그대로 들어 있다 — 전도사가
 * 연락해야 하므로 가릴 수 없는 값이다. 그래서 이 경로는 임원(L) 이상이고,
 * <b>보유기간 1년</b> 뒤에는 원본 자체가 지워진다.
 */
@Schema(description = "새가족 신청")
public record NewcomerRecordResponse(

        @Schema(example = "14")
        String id,

        @Schema(example = "김도연")
        String name,

        @Schema(description = "전도사가 연락할 번호. ⚠️ 가리지 않는다", example = "010-1234-5678")
        String phone,

        @Schema(description = "선택 항목이라 null일 수 있다", nullable = true)
        Gender gender,

        @Schema(nullable = true)
        AgeGroup ageGroup,

        @Schema(nullable = true)
        Referrer referrer,

        @Schema(description = "하고 싶은 말. 비워둘 수 있다", nullable = true)
        String message,

        @Schema(description = "신청 시각 (ISO-8601 UTC)")
        Instant createdAt
) {

    static NewcomerRecordResponse of(NewcomerRequest request) {
        return new NewcomerRecordResponse(
                String.valueOf(request.getId()),
                request.getName(),
                request.getPhone(),
                request.getGender(),
                request.getAgeGroup(),
                request.getReferrer(),
                request.getMessage(),
                request.getCreatedAt());
    }
}
