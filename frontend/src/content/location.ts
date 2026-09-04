/**
 * 위치·지도 링크 상수.
 *
 * `/location`과 `/welcome`이 같은 장소를 안내한다. `/welcome`의 "지도 앱으로
 * 열기" 버튼은 링크를 몰라서 **영구 비활성**으로 남아 있었는데, 바로 옆
 * `/location`에는 동작하는 카카오맵·네이버지도 링크가 이미 있었다. 같은 값을
 * 두 곳이 각자 들고 있어서 생긴 일이라 한 곳으로 모은다.
 *
 * ⚠️ 여기 있는 것은 **드림센터(청년예배 장소)** 주소다. 모교회 본당과 다르다 —
 * `/welcome`이 두 곳을 구분해 안내하는 이유다. 도보 경로·시간은 2026-09-04에
 * 카카오맵 도보 길찾기로 확정했다 (아래 `WALK_*`, 약도는 `ui/RouteMap.tsx`).
 */

/** 청년예배 장소 (WIREFRAME §8) */
export const ADDRESS = "경남 김해시 분성로317번길 31";

/** 모교회 본당. 청년예배 장소가 아니다 — 안내에서 둘을 붙여 쓸 때만 참조한다 */
export const MAIN_CHURCH_ADDRESS = "경남 김해시 가락로 117";

/** 본당 → 드림센터 도보 (카카오맵 실측 2026-09-04, 3개 경로안 모두 동일) */
export const WALK_MINUTES = 2;
export const WALK_METERS = 134;

/** 건물·층 표기까지 포함한 안내용 문자열 */
export const VENUE = "드림센터 4층";

export const KAKAO_MAP_URL = `https://map.kakao.com/link/search/${encodeURIComponent(ADDRESS)}`;
export const NAVER_MAP_URL = `https://map.naver.com/p/search/${encodeURIComponent(ADDRESS)}`;
