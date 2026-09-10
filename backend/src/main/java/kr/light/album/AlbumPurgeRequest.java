package kr.light.album;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/**
 * 정리 실행 요청 (SPEC_API.md §6.11).
 *
 * <p><b>★ 개수가 아니라 id 목록을 받는다.</b> "오래된 3개를 지워라"로 받으면,
 * 미리보기와 실행 사이에 더 오래된 행사일의 앨범이 새로 만들어졌을 때
 * <b>화면에서 본 것과 다른 앨범이 지워진다.</b> 되돌릴 수 없는 동작이라
 * 그 위험을 남겨두지 않는다.
 */
@Schema(name = "AlbumPurgeRequest", description = "정리 실행 요청")
public record AlbumPurgeRequest(

        @Schema(description = "미리보기에서 받은 앨범 id들", example = "[\"5\", \"7\"]")
        @NotEmpty(message = "지울 앨범을 선택해주세요.")
        List<Long> albumIds
) {
}
