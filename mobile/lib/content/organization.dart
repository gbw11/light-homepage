// 원본: frontend/src/app/about/organization/page.tsx 의 `VILLAGE_COUNT` · `TEAMS` ·
// `TEAM_ROLES` — 바뀌면 두 곳을 함께 고친다 (기획안 결정 D6).
//
// PM 결정 2026-09-10 (`docs/records/DECISIONS.md`) — 마을 이름 · 임원단 명단은
// 이미 확정됐지만 다른 작업을 다 마친 뒤 맨 마지막에 채운다. 그때까지 웹과 같이
// ❓ / "마을 1"~"마을 9" 자리표시를 그대로 둔다 — 값을 지어내지 않는다.
// 팀 이름 6개는 확정이라 그대로 옮겼다.

/// 임원단 자리 수 — 이름 · 직분은 아직 ❓
const officerCount = 4;

/// 마을 수 — 모든 회원이 한 마을에 속한다 (1인 1마을)
const villageCount = 9;

/// 팀 — 지원제, 마을 소속과 별개
const teams = ['찬양팀', '중보기도팀', '양육팀', '심방팀', '미디어팀', '선교팀'];

/// 팀 하나의 구성
const teamRoles = ['팀장', '총무', '회계', '팀원'];

/// 아직 채우지 않은 칸에 쓰는 표시 (웹과 같은 글자)
const unknownLabel = '❓ 확인 필요';
