/**
 * 외부 링크 상수.
 *
 * 헤더·푸터·말씀 페이지가 각자 같은 주소를 박고 있었고, 그중 YouTube는
 * **서로 다른 값**이었다 — 말씀 페이지는 실제 채널(`@light4402`)을, 헤더·푸터는
 * `youtube.com` 홈을 가리켰다. 그래서 누른 사람이 엉뚱한 곳에 도착했다.
 * 값이 바뀔 수 있고 여러 화면이 쓰므로 한 곳에 모은다
 * (`CONVENTIONS.md §2` — 재사용 시점에 모은다).
 *
 * ⚠️ **`null`은 "아직 모른다"는 뜻이다.** 렌더하는 쪽에서 `null`을 걸러
 * 항목 자체를 그리지 않는다 — 없는 계정을 링크로 두면 방문자가 빈손으로
 * 돌아온다. 확정되면 여기만 채우면 화면 3곳이 함께 살아난다
 * (`docs/spec/PLAN.md §8`의 ❓ 목록).
 */

/** LIGHT 청년교회 YouTube 채널 (확정) */
export const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@light4402";

/**
 * LIGHT 청년교회 Instagram — **확정 (PM 확인 2026-09-02)**.
 *
 * `PLAN §8`의 ❓ 하나가 더 닫혔다. 그동안 `null`이라 헤더·푸터·사이드레일의
 * Instagram 링크가 아예 그려지지 않았는데, 이제 세 곳이 함께 살아난다.
 *
 * ⚠️ PM이 준 주소에는 공유 추적 파라미터(`?igsi=…`)가 붙어 있었는데 **떼고
 *    넣었다.** 그 값은 공유 경로를 식별하는 토큰이라 우리 방문자 모두를 같은
 *    토큰으로 보낼 이유가 없고, 시간이 지나면 만료되는 값이다.
 */
export const INSTAGRAM_URL: string | null =
  "https://www.instagram.com/gimhaechurch_light";

/**
 * 모교회(김해교회) 홈페이지 — **확정 (PM 확인 2026-09-01)**.
 *
 * `PLAN §8`의 ❓ 하나가 닫혔다. 그동안 `null`이라 푸터의 "김해교회 홈페이지"
 * 링크가 아예 그려지지 않고 있었다 (없는 주소로 보내는 것보다 낫다는 판단).
 * 이제 값이 있으므로 그 링크가 살아난다.
 */
export const CHURCH_SITE_URL: string | null = "https://www.gloria.or.kr";
