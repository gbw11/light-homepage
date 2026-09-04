package kr.light.storage;

import kr.light.photo.PhotoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** 사진첩 (§6) */
@Component
@RequiredArgsConstructor
class PhotoStorageSource implements StorageSource {

    private final PhotoRepository photoRepository;

    @Override
    public String name() {
        return "사진첩";
    }

    @Override
    public long usedBytes() {
        return photoRepository.sumCommittedSizeBytes();
    }
}
