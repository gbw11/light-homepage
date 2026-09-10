package kr.light.notification;

import io.swagger.v3.oas.annotations.media.Schema;
import kr.light.newcomer.NewcomerRequest;

import java.time.Instant;

/**
 * 알림 한 건.
 *
 * <p>⚠️ <b>전화번호는 넣지 않는다.</b> 이름만으로 "누가 왔는지"는 알 수 있고,
 * 연락처는 목록(§8.6)에 이미 있다. 알림은 화면 구석에 오래 떠 있는 편이라
 * 개인정보를 여기까지 늘리지 않는다.
 */
@Schema(description = "알림 한 건")
public record NotificationItemResponse(

        @Schema(description = "무엇 때문에 생긴 알림인가")
        NotificationType type,

        @Schema(description = "가리키는 대상의 id. type=NEWCOMER면 새가족 신청 id다",
                example = "14")
        String refId,

        @Schema(description = """
                누구/무엇에 대한 알림인지 한 줄. type=NEWCOMER면 신청자 이름이다.

                ⚠️ 문구를 서버가 만들지 않는다 — "새가족 신청" 같은 말은 FE가
                type을 보고 붙인다. 서버가 완성된 문장을 내려주면 문구를
                고칠 때마다 배포해야 한다.""", example = "김도연")
        String subject,

        @Schema(description = "알림이 생긴 시각 (ISO-8601 UTC). 최근이 위다")
        Instant createdAt
) {

    static NotificationItemResponse ofNewcomer(NewcomerRequest request) {
        return new NotificationItemResponse(
                NotificationType.NEWCOMER,
                String.valueOf(request.getId()),
                request.getName(),
                request.getCreatedAt());
    }
}
