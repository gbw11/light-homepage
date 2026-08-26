package kr.light.newcomer;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 등록 성공 응답 — {@code 201 { "data": { "id": "14" } }} (SPEC_API.md §9.1).
 *
 * <p>⚠️ 접수 번호만 돌려준다. 신청 내용을 그대로 되돌려주면 공개 엔드포인트가
 * 개인정보를 반사하는 통로가 된다.
 */
@Schema(name = "NewcomerCreated", description = "새가족 등록 결과")
public record NewcomerCreatedResponse(

        @Schema(description = "접수 ID. 문자열이다.", example = "\"14\"")
        String id
) {

    static NewcomerCreatedResponse of(NewcomerRequest request) {
        return new NewcomerCreatedResponse(String.valueOf(request.getId()));
    }
}
