package kr.light.push;

import kr.light.post.PostCategory;

import java.time.LocalDate;

/**
 * 알림을 낳는 일들 (SPEC_API.md §15.3). 각 서비스가 저장 <b>안에서</b> 이 이벤트를
 * 내고, {@link PushNotifier}가 <b>커밋된 뒤에</b> 받아 보낸다 — 저장이 되돌려지면
 * 알림도 나가지 않는다.
 */
public final class PushEvents {

    /** 공지가 처음 게시됐다 (임시저장 → 게시 포함, 다시 저장은 아님) */
    public record PostPublished(Long postId, PostCategory category, String title) {
    }

    /** 주보가 올라왔다 */
    public record BulletinUploaded(Long bulletinId, LocalDate serviceDate) {
    }

    /** 새가족 신청이 들어왔다 — 이름 · 연락처는 싣지 않는다(잠금 화면에 보인다) */
    public record NewcomerRegistered(Long newcomerId) {
    }

    private PushEvents() {
    }
}
