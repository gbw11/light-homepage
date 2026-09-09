package kr.light.album;

import kr.light.common.ApiException;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * 사진 목록 커서 (SPEC_API.md §6.4).
 *
 * <p>값은 <b>마지막으로 받은 사진의 id</b>다. 그것을 base64url로 감싼다 —
 * 계약 예시가 {@code "eyJpZCI6OTIxfQ"}(즉 {@code {"id":921}})라 불투명한
 * 문자열임을 전제하고 있고, FE가 이 값을 해석하거나 계산해서 만들지 않게
 * 하려는 것이다. 숫자를 그대로 노출하면 언젠가 FE가 {@code cursor+1} 같은
 * 것을 시도한다.
 *
 * <p>⚠️ 이 값은 <b>비밀이 아니다.</b> base64는 인코딩이지 암호가 아니고,
 * 여기 담긴 것은 이미 응답에 실려 나가는 사진 id다.
 */
final class PhotoCursor {

    private static final String PREFIX = "{\"id\":";
    private static final String SUFFIX = "}";

    private PhotoCursor() {
    }

    static String encode(Long lastId) {
        String json = PREFIX + lastId + SUFFIX;
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(json.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * 커서를 id로 되돌린다. 비어 있으면 처음부터다.
     *
     * <p>망가진 커서는 {@code VALIDATION_ERROR}다 — 조용히 처음부터 주면
     * 무한 스크롤이 같은 사진을 다시 그리며 끝나지 않는다.
     */
    static long decode(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return 0L;
        }
        try {
            String json = new String(
                    Base64.getUrlDecoder().decode(cursor.trim()), StandardCharsets.UTF_8);
            if (!json.startsWith(PREFIX) || !json.endsWith(SUFFIX)) {
                throw new IllegalArgumentException(json);
            }
            long id = Long.parseLong(json.substring(PREFIX.length(), json.length() - 1));
            if (id < 0) {
                throw new IllegalArgumentException(json);
            }
            return id;
        } catch (IllegalArgumentException e) {
            throw ApiException.validation("cursor", "잘못된 커서입니다.");
        }
    }
}
