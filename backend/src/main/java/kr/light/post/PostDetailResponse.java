package kr.light.post;

import com.fasterxml.jackson.databind.JsonNode;
import io.swagger.v3.oas.annotations.media.Schema;
import kr.light.attachment.Attachment;

import java.time.Instant;
import java.util.List;

/**
 * 게시물 상세 (SPEC_API.md §3.3).
 *
 * <p>목록({@link PostSummaryResponse})에 {@code body}·{@code updatedAt}·
 * {@code attachments}가 더해진 형태다.
 */
@Schema(name = "PostDetail", description = "게시물 상세")
public record PostDetailResponse(

        @Schema(description = "게시물 ID. 문자열이다.", example = "\"18\"")
        String id,

        @Schema(example = "NOTICE_PUBLIC")
        PostCategory category,

        @Schema(example = "여름 수련회 신청 안내")
        String title,

        @Schema(description = "공개 공지만 쓰는 SEO용 주소. 다른 분류는 null이다.",
                example = "summer-retreat-2026", nullable = true)
        String slug,

        /**
         * 리치텍스트 JSON (Tiptap).
         *
         * <p><b>⚠️ DB에는 문자열로 들어 있지만 응답에서는 JSON 객체다</b>
         * ({@code "body": { "type": "doc", ... }}). 문자열로 감싸 내보내면 FE가 한 번 더
         * {@code JSON.parse}를 해야 하고 계약과도 어긋난다.
         *
         * <p>{@code @JsonRawValue String}이 아니라 {@link JsonNode}를 쓰는 이유는 두
         * 가지다. 첫째, 계약서에 {@code type: object}로 실린다 — raw 문자열이면
         * springdoc이 {@code type: string}으로 적어 FE가 정반대로 읽는다. 둘째,
         * <b>깨진 JSON이 응답 전체를 파싱 불가능하게 만드는 일이 없다</b> — 여기서
         * 먼저 터진다.
         */
        @Schema(description = "리치텍스트 JSON (Tiptap)", type = "object",
                example = "{\"type\":\"doc\",\"content\":[]}")
        JsonNode body,

        @Schema(example = "true")
        boolean pinned,

        @Schema(description = "작성자 실명. 작성자가 탈퇴하면 null이다.",
                example = "박도연", nullable = true)
        String authorName,

        @Schema(example = "2026-08-24T01:00:00Z")
        Instant publishedAt,

        @Schema(example = "2026-08-24T01:00:00Z")
        Instant updatedAt,

        List<PostAttachment> attachments
) {

    /**
     * 상세 응답에 실리는 첨부 정보.
     *
     * <p>⚠️ {@code r2Key}는 절대 넣지 않는다. 다운로드는 별도 엔드포인트가
     * presigned URL로 내보낸다 (SPEC_API.md §4.2).
     */
    @Schema(name = "PostAttachment", description = "게시물 첨부파일")
    public record PostAttachment(

            @Schema(description = "첨부 ID. 문자열이다.", example = "\"7\"")
            String id,

            @Schema(example = "신청서.xlsx")
            String filename,

            @Schema(example = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    nullable = true)
            String contentType,

            @Schema(description = "바이트 크기. 숫자다.", example = "24576")
            long sizeBytes
    ) {

        static PostAttachment of(Attachment attachment) {
            return new PostAttachment(
                    String.valueOf(attachment.getId()),
                    attachment.getFilename(),
                    attachment.getContentType(),
                    attachment.getSizeBytes()
            );
        }
    }

    static PostDetailResponse of(Post post, JsonNode body, List<Attachment> attachments) {
        return new PostDetailResponse(
                String.valueOf(post.getId()),
                post.getCategory(),
                post.getTitle(),
                post.getSlug(),
                body,
                post.isPinned(),
                post.getAuthor() != null ? post.getAuthor().getName() : null,
                post.getPublishedAt(),
                post.getUpdatedAt(),
                attachments.stream().map(PostAttachment::of).toList()
        );
    }
}
