package kr.light.storage;

import kr.light.meeting.MeetingDocPageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 월례회 문서 페이지 (§7).
 *
 * <p>⚠️ 업로드는 M4라 지금은 항상 0이다. 그래도 <b>지금</b> 등록해 둔다 —
 * 회계를 짜는 이 시점이 아니면 이 소비처를 다시 떠올릴 계기가 없고,
 * 스캔 이미지 여러 장이라 무게가 가볍지 않다.
 */
@Component
@RequiredArgsConstructor
class MeetingPageStorageSource implements StorageSource {

    private final MeetingDocPageRepository meetingDocPageRepository;

    @Override
    public String name() {
        return "월례회 문서";
    }

    @Override
    public long usedBytes() {
        return meetingDocPageRepository.sumSizeBytes();
    }
}
