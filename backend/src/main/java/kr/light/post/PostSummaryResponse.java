package kr.light.post;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

/**
 * 게시물 목록 아이템 (SPEC_API.md §3.2).
 *
 * <p><b>⚠️ {@code id}는 String이다.</b> 전역 Long→String 직렬화를 걸지 않기로
 * 했으므로 DTO에서 직접 선언해 지킨다. 반면 {@code attachmentCount}는 숫자
 * 그대로다 — ID만 문자열이고 나머지 숫자는 숫자다 (SPEC_API.md §1.3).
 *
 * <p>{@code body}·{@code updatedAt}은 목록에 넣지 않는다. 상세에만 있다.
 */
@Schema(name = "PostSummary", description = "게시물 목록 아이템")
public record PostSummaryResponse(

        @Schema(description = "게시물 ID. 문자열이다.", example = "\"18\"")
        String id,

        @Schema(example = "NOTICE_PUBLIC")
        PostCategory category,

        @Schema(example = "여름 수련회 신청 안내")
        String title,

        @Schema(description = "공개 공지만 쓰는 SEO용 주소. 다른 분류는 null이다.",
                example = "summer-retreat-2026", nullable = true)
        String slug,

        @Schema(description = "상단 고정 여부. 목록 정렬에서 최신순보다 우선한다.", example = "true")
        boolean pinned,

        @Schema(description = "작성자 실명. 작성자가 탈퇴하면 null이다.",
                example = "박도연", nullable = true)
        String authorName,

        @Schema(description = "게시 시각. ISO-8601 UTC.", example = "2026-08-24T01:00:00Z")
        Instant publishedAt,

        @Schema(description = "첨부파일 개수", example = "1")
        long attachmentCount
) {

    static PostSummaryResponse of(Post post, long attachmentCount) {
        return new PostSummaryResponse(
                String.valueOf(post.getId()),
                post.getCategory(),
                post.getTitle(),
                post.getSlug(),
                post.isPinned(),
                // 작성자가 탈퇴해도 글은 남는다 (author_id ON DELETE SET NULL)
                post.getAuthor() != null ? post.getAuthor().getName() : null,
                post.getPublishedAt(),
                attachmentCount
        );
    }
}
