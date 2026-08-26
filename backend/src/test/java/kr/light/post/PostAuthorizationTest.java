package kr.light.post;

import kr.light.common.ApiException;
import kr.light.common.ErrorCode;
import kr.light.member.Role;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.params.provider.Arguments.arguments;

/**
 * 인가 매트릭스 — 게시물 (ARCHITECTURE.md §5.3).
 *
 * <p><b>이 프로젝트에는 RLS가 없다. 이 테스트가 마지막 방어선이다.</b>
 * Jenkinsfile이 {@code --tests "*Authorization*"}으로 이 클래스를 따로 먼저
 * 돌린다 — <b>클래스 이름에서 {@code Authorization}을 빼면 CI가 찾지 못한다.</b>
 *
 * <p>여기서는 단일 관문({@link PostQueryService#assertReadable} ·
 * {@link PostQueryService#assertVisible})을 직접 검증한다. 컨트롤러를 태우는
 * 검증은 {@link PostApiTest}에 있는데, 인증 수단이 M2라 지금 HTTP로는 GUEST 행밖에
 * 만들 수 없다. 반면 관문은 역할을 인자로 받으므로 <b>표 전체를 지금 덮을 수 있다</b>
 * — M2에서 JWT가 붙어도 이 표는 그대로 유효하다.
 *
 * <p>기대값은 ARCHITECTURE.md §5.3 · SPEC_API.md §10의 표를 그대로 옮긴 것이다.
 * 표가 바뀌면 여기도 함께 바꾼다.
 */
class PostAuthorizationTest {

    /** 관문은 리포지토리·매퍼를 쓰지 않는다. 권한 판단만 떼어 보기 위해 null로 둔다. */
    private final PostQueryService service = new PostQueryService(null, null, null);

    // ── 목록 GET /api/posts?category= ──────────────────────────

    /**
     * 매트릭스 4행. {@code null} 역할은 비로그인(GUEST)이다.
     *
     * <p>기대 에러가 {@code null}이면 "통과(200)"를 뜻한다.
     */
    static Stream<Arguments> listMatrix() {
        return Stream.of(
                // category,                          role,         기대 에러 (null이면 200)
                arguments(PostCategory.NOTICE_PUBLIC, null,         null),
                arguments(PostCategory.NOTICE_PUBLIC, Role.PENDING, null),
                arguments(PostCategory.NOTICE_PUBLIC, Role.MEMBER,  null),
                arguments(PostCategory.NOTICE_PUBLIC, Role.LEADER,  null),
                arguments(PostCategory.NOTICE_PUBLIC, Role.PASTOR,  null),

                arguments(PostCategory.NOTICE_MEMBER, null,         ErrorCode.UNAUTHORIZED),
                arguments(PostCategory.NOTICE_MEMBER, Role.PENDING, ErrorCode.PENDING_APPROVAL),
                arguments(PostCategory.NOTICE_MEMBER, Role.MEMBER,  null),
                arguments(PostCategory.NOTICE_MEMBER, Role.LEADER,  null),
                arguments(PostCategory.NOTICE_MEMBER, Role.PASTOR,  null),

                arguments(PostCategory.MINUTES,       null,         ErrorCode.UNAUTHORIZED),
                arguments(PostCategory.MINUTES,       Role.PENDING, ErrorCode.PENDING_APPROVAL),
                arguments(PostCategory.MINUTES,       Role.MEMBER,  ErrorCode.FORBIDDEN),
                arguments(PostCategory.MINUTES,       Role.LEADER,  null),
                arguments(PostCategory.MINUTES,       Role.PASTOR,  null),

                arguments(PostCategory.BUDGET,        null,         ErrorCode.UNAUTHORIZED),
                arguments(PostCategory.BUDGET,        Role.PENDING, ErrorCode.PENDING_APPROVAL),
                arguments(PostCategory.BUDGET,        Role.MEMBER,  ErrorCode.FORBIDDEN),
                arguments(PostCategory.BUDGET,        Role.LEADER,  null),
                arguments(PostCategory.BUDGET,        Role.PASTOR,  null)
        );
    }

    @ParameterizedTest(name = "목록 {0} × {1} → {2}")
    @MethodSource("listMatrix")
    void 목록_인가_매트릭스(PostCategory category, Role role, ErrorCode expected) {
        if (expected == null) {
            assertThatCode(() -> service.assertReadable(category, role))
                    .doesNotThrowAnyException();
            return;
        }
        assertThatThrownBy(() -> service.assertReadable(category, role))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).code())
                .isEqualTo(expected);
    }

    // ── 상세 GET /api/posts/{id} ───────────────────────────────

    /**
     * 매트릭스의 {@code GET /api/posts/{예산안id}} 행.
     *
     * <p>목록과 갈리는 칸이 하나 있다 — <b>MEMBER는 403이 아니라 404다.</b>
     * 403을 주면 "그 예산안 글이 존재한다"는 사실이 새어나간다.
     */
    static Stream<Arguments> budgetDetailMatrix() {
        return Stream.of(
                arguments(null,         ErrorCode.UNAUTHORIZED),
                arguments(Role.PENDING, ErrorCode.PENDING_APPROVAL),
                arguments(Role.MEMBER,  ErrorCode.NOT_FOUND),
                arguments(Role.LEADER,  null),
                arguments(Role.PASTOR,  null)
        );
    }

    @ParameterizedTest(name = "예산안 상세 × {0} → {1}")
    @MethodSource("budgetDetailMatrix")
    void 예산안_상세는_존재를_숨긴다(Role role, ErrorCode expected) {
        if (expected == null) {
            assertThatCode(() -> service.assertVisible(PostCategory.BUDGET, role))
                    .doesNotThrowAnyException();
            return;
        }
        assertThatThrownBy(() -> service.assertVisible(PostCategory.BUDGET, role))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).code())
                .isEqualTo(expected);
    }

    @Test
    @DisplayName("상세에서 역할부족만 404로 바뀐다 — 401·PENDING_APPROVAL은 그대로")
    void 상세는_역할부족만_404로_바꾼다() {
        // 목록에서는 403
        assertThatThrownBy(() -> service.assertReadable(PostCategory.MINUTES, Role.MEMBER))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).code())
                .isEqualTo(ErrorCode.FORBIDDEN);

        // 상세에서는 404 — 존재를 숨긴다
        assertThatThrownBy(() -> service.assertVisible(PostCategory.MINUTES, Role.MEMBER))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).code())
                .isEqualTo(ErrorCode.NOT_FOUND);

        // 비로그인은 401 그대로 — 로그인하면 볼 수 있을지도 모르기 때문
        assertThatThrownBy(() -> service.assertVisible(PostCategory.MINUTES, null))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).code())
                .isEqualTo(ErrorCode.UNAUTHORIZED);
    }

    @Test
    @DisplayName("분류를 추가하고 매트릭스에 행을 넣지 않으면 여기서 걸린다")
    void 모든_분류가_매트릭스에_있다() {
        // "표에 없는 보호 엔드포인트는 미완성으로 본다" (ARCHITECTURE.md §5.3)
        long covered = listMatrix()
                .map(args -> (PostCategory) args.get()[0])
                .distinct()
                .count();
        assertThat(covered).isEqualTo(PostCategory.values().length);
    }
}
