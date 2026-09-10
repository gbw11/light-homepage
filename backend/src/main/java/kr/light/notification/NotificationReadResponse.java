package kr.light.notification;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

/**
 * 읽음 처리 결과.
 *
 * <p>남은 개수를 함께 돌려준다 — 배지를 갱신하려고 목록을 한 번 더 부르지
 * 않게 하기 위해서다.
 */
@Schema(description = "읽음 처리 결과")
public record NotificationReadResponse(

        @Schema(description = """
                실제로 표시된 시각. 보낸 `until`과 다를 수 있다 — 미래 시각은
                서버 시각으로 잘리고, 이미 표시한 시각보다 과거면 무시된다.""")
        Instant readUntil,

        @Schema(description = "처리 후 남은 안 읽은 알림 수. 0이면 배지를 없앤다",
                example = "0")
        long unreadCount
) {
}
