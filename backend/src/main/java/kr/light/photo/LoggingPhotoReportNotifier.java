package kr.light.photo;

import kr.light.member.Member;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 임시 구현 — 로그만 남긴다.
 *
 * <p>메일·카톡 발송은 계정과 키가 없어 아직 붙이지 못했다. 그래서 지금은
 * <b>임원이 신고를 자동으로 알 방법이 없다</b> — 감사 로그({@code audit_logs})에
 * 남으므로 요청이 사라지지는 않지만, 누군가 들여다봐야 안다.
 *
 * <p>⚠️ 신고 내용({@code reason})을 찍지 않는다. "제 얼굴이 나온 사진입니다"
 * 같은 문장 자체가 개인정보라, 로그에 쌓이면 지울 수 없게 된다.
 */
@Slf4j
@Component
class LoggingPhotoReportNotifier implements PhotoReportNotifier {

    @Override
    public void notifyPhotoReported(Photo photo, Member reporter) {
        log.warn("⚠️ 사진 신고 접수 — photo={} album={} reporter={} · "
                        + "임원이 확인해야 한다 (알림 발송 미구현, audit_logs에 기록됨)",
                photo.getId(), photo.getAlbum().getId(), reporter.getId());
    }
}
