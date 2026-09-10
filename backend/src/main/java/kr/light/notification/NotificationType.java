package kr.light.notification;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 알림이 무엇 때문에 생겼는가.
 *
 * <p><b>★ 값이 하나뿐인데 왜 enum인가.</b> 지금 알림을 만드는 것은 새가족
 * 신청뿐이다(2026-09-09 결정 — 나머지는 나중에). 그런데 사진 신고(§6.10)나
 * 용량 경고(§8.5)가 뒤에 붙는 것은 사실상 정해져 있고, 그때 응답 형태가
 * 바뀌면 <b>FE가 알림 화면을 다시 만들어야 한다.</b>
 *
 * <p>지금 이 필드를 하나 넣어두면 그때는 값이 하나 늘어날 뿐이다. FE가
 * 처음부터 {@code type}으로 갈라 쓰면 화면은 그대로 남는다.
 */
@Schema(description = "알림의 출처. 지금은 NEWCOMER 하나지만 FE는 이 값으로 갈라 쓸 것")
public enum NotificationType {

    /** 새가족 등록 신청이 들어왔다 (§9.1 · §8.6) */
    NEWCOMER
}
