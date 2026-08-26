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
 * (`docs/PLAN.md §8`의 ❓ 목록).
 */

/** LIGHT 청년교회 YouTube 채널 (확정) */
export const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@light4402";

/**
 * Instagram 핸들 미확정 (`PLAN §8`). 예전 값 `https://instagram.com`은
 * 인스타그램 홈으로 가는 링크여서 아무 의미가 없었다.
 */
export const INSTAGRAM_URL: string | null = null;

/**
 * 모교회(김해교회) 홈페이지 주소 미확정 (`PLAN §8`).
 * 예전 값 `https://gimhae.church`는 확인된 주소가 아니다 — PM 확인 필요.
 */
export const CHURCH_SITE_URL: string | null = null;
