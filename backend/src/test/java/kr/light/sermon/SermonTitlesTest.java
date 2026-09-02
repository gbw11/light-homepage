package kr.light.sermon;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 무엇이 설교인가 (SPEC_API.md §9.2).
 *
 * <p><b>아래 제목은 전부 실제 채널(210편)에서 그대로 가져온 것</b>이다
 * (2026-09-02 전수 확인). 규칙을 손댈 때 이 목록이 무너지면 브이로그가
 * 말씀 목록에 뜨거나 설교가 사라진다.
 *
 * <p>제목 형식이 시대별로 세 가지라는 것이 이 테스트의 핵심이다 —
 * 처음에 ①만 잡는 규칙을 썼다가 210편 중 38편만 걸린 적이 있다.
 */
class SermonTitlesTest {

    @ParameterizedTest(name = "① 최신 형식: {0}")
    @ValueSource(strings = {
            "2026년 8월 30일 l 하나님께 소망을 두고 있나요? l [김해교회 LIGHT청년교회]",
            "2026년 8월 23일 l 세상을 비추는 빛 l [김해교회 LIGHT청년교회]",
            // 한 자리 월·일
            "2026년 8월 9일 무너지는 나라  [김해교회 LIGHT청년교회]",
            "2026년 7월 5일 ㅣ주께로 향하는 길  [김해교회 LIGHT청년교회]",
            // 공백 없는 표기
            "2026년8월2일 주의 장막으로",
    })
    void 최신_형식(String title) {
        assertThat(SermonTitles.isSermon(title)).isTrue();
    }

    @ParameterizedTest(name = "② 2025 후반 형식: {0}")
    @ValueSource(strings = {
            "세상을 밝히는 빛, LIGHT 공동체/2025-10-12/주일 예배/\"모두에게 베푼 은혜\"/누가복음 17장",
            "세상을 밝히는 빛, LIGHT 공동체/2025-09-28/주일 예배/\"엘리야의 선포\"/열왕기상 17장",
            // 한 자리 일 (2025-09-7)
            "세상을 밝히는 빛, LIGHT 공동체/2025-09-7/\"여전히 두려움 속에 있을 때\"/사사기 7장",
    })
    void 중간_형식(String title) {
        assertThat(SermonTitles.isSermon(title)).isTrue();
    }

    @ParameterizedTest(name = "③ 2024~2025 형식: {0}")
    @ValueSource(strings = {
            "세상을 밝히는 빛, LIGHT 공동체 2025-2-23 청년교회 주일 예배/\"여호와께 손을 들라\"/출애굽기",
            "세상을 밝히는 빛, LIGHT 공동체 2025-1-12 청년교회 주일 예배/\"마르고 시드는 것과 영원한 것\"",
            "세상을 밝히는 빛, LIGHT 공동체 2024-12-08 청년교회 주일 예배/두 증인/요한계시록 11장",
    })
    void 초기_형식(String title) {
        assertThat(SermonTitles.isSermon(title)).isTrue();
    }

    @ParameterizedTest(name = "설교 아님: {0}")
    @ValueSource(strings = {
            // ★ 연도만 있다 — 월·일까지 요구하는 이유
            "2026 하계수련회 보고영상 | LIGHT 청년교회",
            "2026 곡성 국내선교 보고영상 | Blessing 곡성",
            "김해교회 LIGHT 청년교회 | 오프닝 | 2026",
            "2026 제8회 부산노회 청년 연합수련회 보고영상 | LIGHT 청년교회",
            "2025 여름 리트릿 보고영상 | LIGHT 청년교회",
            // 날짜가 아예 없다
            "날씨가 좋고 벚꽃이 많았어요 | VLOG | 김해교회 LIGHT 청년교회",
            "우린 주님만 따라가리 | Resonance 찬양팀 COVER | 김해교회 LIGHT 청년교회",
            "TEASER",
            "어딘가로 잠시 떠나가야 할 때 | LIGHT 다큐 시리즈 [팀 알아보기] - 심방팀편",
    })
    void 설교가_아닌_것(String title) {
        assertThat(SermonTitles.isSermon(title)).isFalse();
    }

    @ParameterizedTest
    @NullAndEmptySource
    @DisplayName("제목이 없으면 설교가 아니다 — null로 터지지 않는다")
    void 빈_제목(String title) {
        assertThat(SermonTitles.isSermon(title)).isFalse();
    }

    @ParameterizedTest(name = "경계: {0}")
    @ValueSource(strings = {
            // 8/15 같은 월/일만 — 연도가 없어 날짜로 보지 않는다
            "8/15 WELOVE 찬양 풀버전 | 2025 여름 리트릿 | LIGHT 청년교회",
    })
    @DisplayName("연도 없는 월/일은 날짜로 보지 않는다 — 찬양 영상이 섞이면 안 된다")
    void 연도가_없으면_날짜가_아니다(String title) {
        assertThat(SermonTitles.isSermon(title)).isFalse();
    }
}
