/**
 * 위치·지도 링크 상수.
 *
 * `/location`과 `/welcome`이 같은 장소를 안내한다. `/welcome`의 "지도 앱으로
 * 열기" 버튼은 링크를 몰라서 **영구 비활성**으로 남아 있었는데, 바로 옆
 * `/location`에는 동작하는 카카오맵·네이버지도 링크가 이미 있었다. 같은 값을
 * 두 곳이 각자 들고 있어서 생긴 일이라 한 곳으로 모은다.
 *
 * ⚠️ 여기 있는 것은 **드림센터(청년예배 장소)** 주소다. 모교회 본당과 다르다 —
 * `/welcome`이 "본당 앞에서 도보 ❓"를 안내하는 이유이고, 그 도보 경로·시간은
 * 아직 확정되지 않았다 (`docs/spec/PLAN.md §8`).
 */

/** 청년예배 장소 (WIREFRAME §8) */
export const ADDRESS = "경남 김해시 분성로317번길 31";

/** 건물·층 표기까지 포함한 안내용 문자열 */
export const VENUE = "드림센터 4층";

export const KAKAO_MAP_URL = `https://map.kakao.com/link/search/${encodeURIComponent(ADDRESS)}`;
export const NAVER_MAP_URL = `https://map.naver.com/p/search/${encodeURIComponent(ADDRESS)}`;
