package kr.light.notification;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;

/**
 * 안 읽은 알림.
 *
 * <p>{@code items}는 최대 20건까지만 담고,
 * {@code unreadCount}는 <b>자르기 전의 실제 수</b>다 — 배지에 "3"이 떠야 하는데
 * 목록 길이를 세면 잘린 뒤의 수가 나온다.
 */
@Schema(description = "안 읽은 알림 목록")
public record NotificationListResponse(

        @Schema(description = "안 읽은 알림 수. items가 잘려도 이 값은 실제 수다",
                example = "3")
        long unreadCount,

        @Schema(description = "최근이 위. 최대 20건")
        List<NotificationItemResponse> items,

        @Schema(description = "20건보다 많아 잘렸는가", example = "false")
        boolean hasMore,

        @Schema(description = """
                ★ 이 값을 그대로 `POST /api/admin/notifications/read`의 `until`에
                넣으면 **지금 화면에 보이는 것까지만** 읽음이 된다.

                읽는 사이에 새 신청이 들어와도 그것은 안 읽음으로 남는다 —
                `until`을 비워 보내면 "지금까지 전부"가 되어 그 한 건이 조용히
                사라질 수 있다.

                안 읽은 알림이 없으면 `null`이다 (표시할 것이 없으므로).""",
                nullable = true)
        Instant readMarker
) {

    static NotificationListResponse of(long unreadCount, List<NotificationItemResponse> items) {
        return new NotificationListResponse(
                unreadCount,
                items,
                unreadCount > items.size(),
                items.isEmpty() ? null : items.get(0).createdAt());
    }
}
