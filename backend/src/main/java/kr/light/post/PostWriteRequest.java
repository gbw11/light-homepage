package kr.light.post;

import com.fasterxml.jackson.databind.JsonNode;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 게시물 작성·수정 (SPEC_API.md §3.4 · §3.5).
 *
 * <p>작성과 수정이 <b>같은 형태</b>다(§3.5 "수정은 3.4와 동일 형태").
 *
 * <p><b>⚠️ {@code slug}는 요청에 없다.</b> 서버가 제목에서 만든다
 * ({@link PostSlugGenerator}) — 명세의 요청 본문에 그 필드가 없기 때문이다.
 */
@Schema(name = "PostWriteRequest", description = "게시물 작성·수정 요청")
public record PostWriteRequest(

        @Schema(description = "이 값으로 열람 권한이 갈린다. 작성 권한은 네 분류 모두 LEADER 이상.",
                example = "MINUTES", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "분류를 선택해주세요.")
        PostCategory category,

        @Schema(example = "8월 정기 회의록", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "제목을 입력해주세요.")
        @Size(max = 200, message = "제목이 너무 깁니다.")
        String title,

        /**
         * 리치텍스트 JSON (Tiptap).
         *
         * <p>{@link JsonNode}로 받아 <b>JSON임을 바인딩 단계에서 보장</b>한다.
         * 문자열로 받으면 깨진 값이 그대로 저장되고, 나중에 상세 조회가 통째로
         * 500이 된다 — {@code PostDetailResponse}가 겪은 문제다.
         */
        @Schema(description = "리치텍스트 JSON (Tiptap)", type = "object",
                example = "{\"type\":\"doc\",\"content\":[]}",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "본문을 입력해주세요.")
        JsonNode body,

        @Schema(description = "상단 고정. 목록에서 최신순보다 우선한다.", example = "false")
        boolean pinned,

        @Schema(description = "연결할 첨부 ID 목록. 문자열이다.", example = "[\"7\",\"8\"]",
                nullable = true)
        List<String> attachmentIds,

        @Schema(description = "false면 임시저장(`publishedAt = null`)이라 목록에 나오지 않는다.",
                example = "true")
        boolean publish
) {

    /** 없으면 빈 목록으로 다룬다 — 호출부마다 null 검사를 반복하지 않기 위해 */
    List<String> attachmentIdsOrEmpty() {
        return attachmentIds == null ? List.of() : attachmentIds;
    }

    /**
     * 본문이 JSON <b>객체</b>인가.
     *
     * <p>{@code JsonNode}는 문자열·숫자도 유효한 JSON으로 받아들인다
     * ({@code "body": "그냥 문자열"}이 통과한다). 그런데 계약은 객체를 요구하고
     * (SPEC_API.md §3.3의 {@code {"type":"doc",...}}), 상세 응답도 객체로
     * 내보낸다 — 문자열이 저장되면 FE가 받는 형태가 글마다 달라진다.
     */
    @jakarta.validation.constraints.AssertTrue(message = "본문은 JSON 객체여야 합니다.")
    boolean isBodyObject() {
        return body != null && body.isObject();
    }
}
