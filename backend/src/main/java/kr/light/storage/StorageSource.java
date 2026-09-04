package kr.light.storage;

/**
 * R2 저장 용량을 소비하는 곳 하나.
 *
 * <p><b>★ 인터페이스로 둔 이유는 누락을 막기 위해서다.</b> 용량 합계를 서비스
 * 한 곳에 쿼리로 늘어놓으면, 나중에 저장소를 쓰는 기능이 추가될 때 그 줄을
 * 추가하는 것을 잊는다. 그러면 가드는 여전히 "42%"라고 말하는데 실제로는
 * 한도를 넘어 과금이 시작된다 — {@code ARCHITECTURE.md §4.3}이 경고한
 * "용량이 조용히 샌다"가 정확히 이 모양이다.
 *
 * <p>빈으로 등록하면 {@link StorageUsageService}가 자동으로 합계에 넣는다.
 * <b>R2에 객체를 올리는 기능을 만들면 이 인터페이스 구현을 함께 만들 것.</b>
 * {@code StorageUsageServiceTest}가 등록된 구현 수를 확인하고 있다.
 */
public interface StorageSource {

    /** 로그·진단에 쓰는 이름 ("사진첩") */
    String name();

    /** 이 소비처가 R2에서 차지하는 바이트 수 */
    long usedBytes();
}
