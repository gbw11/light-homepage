// 원본: frontend/src/content/location.ts — 값이 바뀌면 두 곳을 함께 고친다
// (기획안 결정 D6). 웹 쪽 주석에 각 값이 정해진 경위가 있다.

/// 청년예배 장소 — 드림센터. 모교회 본당과 **다른 건물**이다
const address = '경남 김해시 분성로317번길 31';

/// 건물·층까지 포함한 안내용 문자열
const venue = '드림센터 4층';

/// 본당 → 드림센터 도보 (카카오맵 실측 2026-09-04)
const walkMinutes = 2;
const walkMeters = 134;

final kakaoMapUrl =
    'https://map.kakao.com/link/search/${Uri.encodeComponent(address)}';
final naverMapUrl =
    'https://map.naver.com/p/search/${Uri.encodeComponent(address)}';

/// 구글 지도 — **앱에만 있다** (웹은 카카오맵 · 네이버지도 두 개). 두 앱이 없는
/// 휴대폰(외국인 방문자 · 아이폰 기본 상태)에서도 길찾기를 열 수 있게 둔다.
/// 공식 "Maps URLs" 형식이라 앱이 있으면 앱, 없으면 브라우저로 열린다.
final googleMapUrl =
    'https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(address)}';
