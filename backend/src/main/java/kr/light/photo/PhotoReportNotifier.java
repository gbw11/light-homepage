package kr.light.photo;

import kr.light.member.Member;

/**
 * 사진 신고 알림 (SPEC_API.md §6.10 "임원에게 전달").
 *
 * <p><b>⚠️ 여기서 실패해도 신고는 성공이다.</b> 알림이 안 나갔다고 신고를
 * 되돌리면, 자기 사진을 내려달라고 한 사람의 요청이 사라진다. 기록은
 * 감사 로그에 이미 남아 있으므로 구현체는 예외를 밖으로 던지지 않는다.
 *
 * <p>⚠️ 구현체는 <b>신고 내용을 로그에 남기지 않는다.</b> "제 얼굴이 나온
 * 사진입니다" 같은 문장 자체가 개인정보다.
 */
public interface PhotoReportNotifier {

    void notifyPhotoReported(Photo photo, Member reporter);
}
