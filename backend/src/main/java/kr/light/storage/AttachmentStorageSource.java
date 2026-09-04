package kr.light.storage;

import kr.light.attachment.AttachmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 게시물 첨부 (§4) <b>와 주보 (§5)</b>.
 *
 * <p>주보 페이지는 별도 테이블이 아니라 {@code attachments}에 {@code bulletin_id}로
 * 매달린다(V1 스키마). 그래서 이 하나가 둘을 함께 센다 — 주보용 소비처를 따로
 * 만들면 같은 행을 두 번 세게 된다.
 */
@Component
@RequiredArgsConstructor
class AttachmentStorageSource implements StorageSource {

    private final AttachmentRepository attachmentRepository;

    @Override
    public String name() {
        return "첨부·주보";
    }

    @Override
    public long usedBytes() {
        return attachmentRepository.sumSizeBytes();
    }
}
