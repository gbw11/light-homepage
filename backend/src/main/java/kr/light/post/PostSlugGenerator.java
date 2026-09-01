package kr.light.post;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.util.Locale;

/**
 * 공개 공지의 slug 생성 — <b>제목에서 만든다</b>.
 *
 * <p>FE가 `/news/[slug]`로 상세를 열고(WIREFRAME.md §7), 공개 페이지는 검색
 * 노출·공유 미리보기 대상이다(FR-PUB-10). 그래서 id가 아니라 읽을 수 있는
 * 주소가 필요하다.
 *
 * <p><b>⚠️ 생성 규칙은 문서에 없다.</b> {@code POST /api/posts}의 요청 본문에
 * slug 필드가 없어 서버가 만들 수밖에 없는데, 어떻게 만들지는 어디에도 정해져
 * 있지 않다. 아래는 이 프로젝트에서 정한 규칙이다 — FE와 공유 대상이다.
 *
 * <p><b>한글을 로마자로 바꾸지 않는다.</b> 변환 규칙을 임의로 정하면 "여름
 * 수련회"가 어색한 표기로 굳고 되돌리기 어렵다. 한글 URL은 브라우저가 잘
 * 처리하고 국문 검색에도 유리하다.
 */
@Component
@RequiredArgsConstructor
public class PostSlugGenerator {

    private final PostRepository postRepository;

    /** DB 컬럼이 varchar(200)이다. 중복 접미사 자리를 남겨 넉넉히 줄인다. */
    private static final int MAX_LENGTH = 180;

    /**
     * 제목에서 slug를 만든다. 이미 있으면 {@code -2}, {@code -3}… 을 붙인다.
     *
     * @param excludedPostId 수정 중인 글의 id. 자기 자신과의 충돌은 무시한다
     *                       (제목을 안 바꾸고 본문만 고치는 경우가 흔하다)
     */
    public String generate(String title, Long excludedPostId) {
        String base = slugify(title);
        if (base.isBlank()) {
            // 제목이 기호뿐이면 만들 것이 없다. id 기반으로 물러선다 —
            // 주소가 예쁘지 않을 뿐 동작은 한다.
            base = "post";
        }

        String candidate = base;
        int suffix = 2;
        while (isTaken(candidate, excludedPostId)) {
            candidate = base + "-" + suffix++;
        }
        return candidate;
    }

    private boolean isTaken(String slug, Long excludedPostId) {
        return postRepository.findBySlug(slug)
                .filter(found -> !found.getId().equals(excludedPostId))
                .isPresent();
    }

    /**
     * 제목 → slug.
     *
     * <ul>
     *   <li>유니코드 정규화(NFC) — 자모가 분리된 한글("ㅇㅕㄹㅡㅁ")을 합친다.
     *       macOS에서 복사한 텍스트가 이런 형태로 오는 일이 있다</li>
     *   <li>공백·연속 하이픈 → 하이픈 하나</li>
     *   <li>한글·영문·숫자·하이픈만 남긴다 — {@code ?}·{@code #}·{@code /}가
     *       남으면 URL이 깨진다</li>
     *   <li>영문은 소문자로. 대소문자만 다른 두 주소가 생기지 않게</li>
     * </ul>
     */
    private String slugify(String title) {
        if (title == null) {
            return "";
        }
        String normalized = Normalizer.normalize(title.trim(), Normalizer.Form.NFC)
                .toLowerCase(Locale.KOREAN);

        String slug = normalized
                .replaceAll("[\\s_]+", "-")
                // 한글 음절·자모, 영문, 숫자, 하이픈만 남긴다
                .replaceAll("[^가-힣ㄱ-ㅎㅏ-ㅣa-z0-9-]", "")
                .replaceAll("-{2,}", "-")
                .replaceAll("^-|-$", "");

        return slug.length() > MAX_LENGTH ? trimAtHyphen(slug) : slug;
    }

    /** 길이를 줄일 때 단어 중간에서 자르지 않는다 */
    private String trimAtHyphen(String slug) {
        String cut = slug.substring(0, MAX_LENGTH);
        int lastHyphen = cut.lastIndexOf('-');
        return lastHyphen > 0 ? cut.substring(0, lastHyphen) : cut;
    }
}
