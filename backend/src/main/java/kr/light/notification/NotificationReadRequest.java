package kr.light.notification;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

/**
 * 읽음 처리 요청.
 *
 * <p>본문 자체를 생략할 수 있다 — 그 경우 "지금까지 전부 읽음"이다.
 *
 * <p>⚠️ <b>검증 애너테이션을 붙이지 않았다.</b> {@code @Valid}가 붙으면 검증이
 * {@code @PreAuthorize}보다 먼저 돌아, 권한 없는 회원이 403이 아니라 400을
 * 받는다 — 막힌 것인지 잘못 보낸 것인지 FE가 구분할 수 없게 된다. 값 하나뿐이고
 * 범위 검사는 서비스에서 한다.
 */
@Schema(description = "읽음 처리 요청. 본문 없이 보내도 된다")
public record NotificationReadRequest(

        @Schema(description = """
                이 시각까지 읽음으로 표시한다. 목록 응답의 `readMarker`를 그대로
                넣는 것이 정석이다.

                생략하면 **서버 시각까지 전부** 읽음이다 — 목록을 본 뒤 새로
                들어온 알림까지 함께 사라질 수 있다.

                미래 시각을 보내도 서버 시각으로 잘린다. 이미 표시한 시각보다
                과거를 보내면 무시된다 (읽은 알림이 되살아나지 않는다).""",
                nullable = true)
        Instant until
) {
}
