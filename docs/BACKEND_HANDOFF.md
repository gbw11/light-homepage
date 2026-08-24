# 프론트 → 백엔드 인계 기록

프론트엔드 작업 중 **백엔드가 알아야 할 내용**이 생길 때마다 모아두는
로그다. **여기 있는 항목은 PM이 별도로 요청하지 않아도, 그런 내용이
생길 때마다 자동으로 추가된다** (`frontend/docs/WORKFLOW.md` §7 규칙).

## 언제 여기에 기록하는가

프론트 작업 중 다음 중 하나에 해당하면 기록한다.

- `@/lib/api` mock으로 화면을 먼저 완성했고, 백엔드가 이 계약대로 구현하면
  바로 연동되는 API가 생겼을 때 (엔드포인트·요청/응답 필드가 확정됨)
- 기존 `docs/SPEC_API.md` 계약과 다르게 구현해야 했던 지점 (계약 변경 필요)
- 프론트 라우트가 새로 생겨서, 백엔드가 리다이렉트·CORS·쿠키 도메인 등에서
  신경 써야 할 경우
- 인가 매트릭스(`ARCHITECTURE.md §5.3`)에 새로 추가돼야 할 행

**단순 UI/디자인 변경, 정적 콘텐츠 수정처럼 백엔드와 무관한 작업은 여기에
기록하지 않는다** — 그런 항목은 `docs/DECISIONS.md`(PM 결정 기록)로 간다.

## 처리 순서

1. 여기 기록
2. PM이 이 항목들을 확인해 백엔드 담당자에게 실제로 전달 (이 문서는 PM이
   전달하기 전 초안 역할 — **자동으로 백엔드에게 전송되지 않는다**)
3. 백엔드가 반영하면, 해당 항목에 `✅ 반영됨 (YYYY-MM-DD)`를 추가한다 (지우지
   않고 남겨서 이력 추적)

형식: 최신 항목이 위에 온다.

---

## 2026-08-24 — M2 인증 기반(auth-core) mock API — 백엔드가 그대로 구현하면 되는 계약

**상태**: 계약 변경 없음. 아래 엔드포인트는 이미 `docs/SPEC_API.md §2`에
정의된 계약 그대로 프론트 mock(`frontend/src/lib/api/mock.ts`)과
real(`frontend/src/lib/api/real.ts`)에 구현해뒀다. 백엔드가 이 그대로
만들면 `NEXT_PUBLIC_USE_MOCK=0`으로 바꾸는 것만으로 연동된다.

| 엔드포인트 | 프론트 사용처 | 스펙 |
|---|---|---|
| `POST /api/auth/signup` | `/signup` | `SPEC_API.md §2.1` |
| `POST /api/auth/login` | `/login` | `SPEC_API.md §2.2` |
| `POST /api/auth/refresh` | `lib/api` 내부(401 재시도용, 아직 화면에서 직접 호출 안 함) | `SPEC_API.md §2.3` |
| `POST /api/auth/logout` | Header 로그아웃, `/my/profile` 로그아웃 | `SPEC_API.md §2.4` |
| `GET /api/auth/me` | `AuthProvider` 전역 세션 소스 | `SPEC_API.md §2.5` |
| `POST /api/auth/complete-profile` | `/signup/complete` | `SPEC_API.md §2.8` |
| `POST /api/auth/password/reset-request` | `/password/reset-request` | `SPEC_API.md §2.9` |
| `POST /api/auth/password/reset` | `/password/reset` | `SPEC_API.md §2.10` |
| `PATCH /api/auth/me` | `/my/profile` 연락처 인라인 수정 | `SPEC_API.md §2.11` |
| `POST /api/auth/password/change` | `/my/profile` 비밀번호 변경 | `SPEC_API.md §2.12` |
| `DELETE /api/auth/me` | `/my/profile` 회원 탈퇴 | `SPEC_API.md §2.13` |

- **왜 필요한지**: M2(인증·회원) 마일스톤 전체가 이 계약에 의존한다
  (`docs/WORKPLAN.md` §6 M2).
- **아직 안 붙인 것**: `GET /api/auth/kakao/authorize`·`kakao/callback`
  (302 리다이렉트 엔드포인트)은 실제 백엔드 라우트로 직접 이동하는
  `<a href="/api/auth/kakao/authorize">` 링크만 걸어뒀다 — `Api` 타입에
  포함하지 않았다(fetch로 부르는 게 아니라 브라우저 이동이라서). 백엔드가
  이 라우트를 만들면 버튼은 그대로 동작해야 한다.
- **미확정 사항 — PM 확인 필요**: `/signup/complete`(카카오 가입 후 추가정보
  화면, `WIREFRAME.md §10-2b`)는 "카카오 닉네임: ___"을 보여줘야 하는데,
  카카오 OAuth 왕복이 아직 없어서 실제 닉네임 소스가 없다. 지금은 임시로
  `GET /api/auth/me`의 `name` 필드를 대신 표시한다. 카카오 연동이 실제로
  구현될 때 다음 중 하나가 필요해 보인다: ① 콜백 리다이렉트에 닉네임을
  쿼리파라미터로 실어보내거나 ② 프로필 미완료 상태의 카카오 세션에 대해
  `AuthUser`와 다른 응답 모양(실명 없이 닉네임만 있는 부분 세션)을 반환하는
  것. 계약을 확정할 때 다시 논의 필요.
- **관련 PR**: `feat/fe-auth-core`, `feat/fe-signup-followup`,
  `feat/fe-password-reset` 브랜치 (M2 인증·회원)

---

## 2026-08-24 — `/my/profile` 내 정보 화면 — 백엔드가 그대로 구현하면 되는 계약

**상태**: 계약 변경 없음. 아래 3개는 이미 `docs/SPEC_API.md`에 있는 계약과
동일하게 프론트 mock(`frontend/src/lib/api/mock.ts`)을 구현해뒀다. 백엔드가
이 그대로 만들면 `NEXT_PUBLIC_USE_MOCK=0`으로 바꾸는 것만으로 연동된다.

| 엔드포인트 | 프론트 사용처 | 스펙 |
|---|---|---|
| `PATCH /api/auth/me` | `/my/profile` 연락처 인라인 수정 | `SPEC_API.md §2.11` |
| `POST /api/auth/password/change` | `/my/profile` 비밀번호 변경 | `SPEC_API.md §2.12` |
| `DELETE /api/auth/me` | `/my/profile` 회원 탈퇴 | `SPEC_API.md §2.13` |

- **왜 필요한지**: M2(인증·회원) 마일스톤의 `/my/profile` 내 정보 화면
  (`WIREFRAME.md §14` 우측)이 이 3개 엔드포인트에 의존한다.
- **미확정 사항**: 없음 — 계약 그대로 구현했다. 다만 `PATCH /api/auth/me`가
  요청 필드로 `phone`만 받는 것으로 가정했다(스펙 예시와 동일) — 다른 필드도
  받게 확장할 계획이 있다면 FE `updateProfile` 시그니처도 같이 넓혀야 한다.
- **관련 PR**: `feat/fe-my-profile` 브랜치 (아직 미머지)

---

## 2026-08-24 — M2 내부 공지 mock API — 백엔드가 그대로 구현하면 되는 계약

**상태**: 계약 변경 없음. `docs/SPEC_API.md §3.1/§3.2/§3.3`에 이미 정의된
`NOTICE_MEMBER` 분류를 프론트 mock(`frontend/src/lib/api/mock.ts`)에
데이터로 채워 `/my/notices`(내부 공지 통합 목록)를 구현했다.

| 엔드포인트 | 프론트 사용처 | 스펙 |
|---|---|---|
| `GET /api/posts?category=NOTICE_MEMBER` | `/my/notices` 통합 목록(공개+내부 병합) | `SPEC_API.md §3.2` |
| `GET /api/posts/{idOrSlug}` | `/my/notices/[slug]` 상세 (카테고리 무관 동일 사용) | `SPEC_API.md §3.3` |

- **왜 필요한지**: `WIREFRAME.md §14` 내부 공지 화면 — `NOTICE_PUBLIC` +
  `NOTICE_MEMBER`를 하나의 목록으로 합쳐 최신순 정렬하고, 내부 글에 🔒
  표시를 붙인다. 정렬·병합은 프론트에서 두 목록을 받아 처리하므로 백엔드가
  통합 정렬 API를 새로 만들 필요는 없다.
- **인가 확인**: `SPEC_API.md §3.1`대로 `NOTICE_MEMBER` 열람은 `M`(회원)
  이상만 가능해야 한다 — 프론트는 `RequireMember`로 비로그인/승인대기
  사용자를 걸러내지만 이건 UI 편의일 뿐이다. **서버가 카테고리별 열람 권한을
  실제로 검사하는지 재확인 필요** (`SPEC_API.md §3.3` 경고: id로 먼저 조회 후
  category 권한 확인 — category 파라미터를 그대로 신뢰하면 우회 가능).
- **미확정 사항**: 없음 — 계약 그대로 사용했다. 다만 위 인가 검사가 실제
  구현에도 반영됐는지는 백엔드 쪽 확인이 필요하다.
- **관련 PR**: `feat/fe-internal-notices` 브랜치 (M2 인증·회원)

---

## 2026-08-21 — M1 공개 영역 mock API — 백엔드가 그대로 구현하면 되는 계약

**상태**: 계약 변경 없음. 아래 3개는 이미 `docs/SPEC_API.md`에 있는 계약과
동일하게 프론트 mock(`frontend/src/lib/api/mock.ts`)을 구현해뒀다. 백엔드가
이 그대로 만들면 `NEXT_PUBLIC_USE_MOCK=0`으로 바꾸는 것만으로 연동된다.

| 엔드포인트 | 프론트 사용처 | 스펙 |
|---|---|---|
| `GET /api/posts?category=NOTICE_PUBLIC` | `/news` 목록 | `SPEC_API.md §3.2` |
| `GET /api/posts/{idOrSlug}` | `/news/[slug]` 상세 | `SPEC_API.md §3.3` |
| `POST /api/newcomers` | `/welcome/register` 새가족 등록 | `SPEC_API.md §9.1` |

- **왜 필요한지**: M1 공개 사이트의 공지·새가족 등록 기능이 이 3개
  엔드포인트에 의존한다 (`SPEC_API.md §10` M1 범위와 일치)
- **미확정 사항**: 없음 — 계약 그대로 구현했다
- **관련 PR**: #19(`posts.get`), #20(`newcomers.submit`)

---

<!--
새 항목 추가 형식:

## YYYY-MM-DD — 한 줄 요약

**상태**: 계약 변경 없음 / [CONTRACT] 변경 필요 / 신규 요구사항

- **내용**: 구체적으로 무엇이 필요한지 (엔드포인트, 요청/응답 필드, 권한)
- **왜 필요한지**: 어느 화면/기능 때문인지
- **미확정 사항**: PM 확인이 필요한 부분
- **관련 PR**: 관련 PR 번호/브랜치
-->
