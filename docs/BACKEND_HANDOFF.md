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

## 2026-08-24 — 글 작성·수정·삭제 + 첨부 업로드 FE 구현 (M4 FR-DOC-01)

**상태**: 계약 변경 1건 필요(`publishedAt` 타입) · 나머지는 `SPEC_API.md
§3.4`·`§3.5`·`§4.1`·`§4.2` 그대로 구현

### 그대로 구현한 것 (백엔드가 스펙대로 만들면 `NEXT_PUBLIC_USE_MOCK=0`으로 연동됨)

| 엔드포인트 | FE 사용처 | 스펙 |
|---|---|---|
| `POST /api/posts` | `/admin/posts/new` 저장 (임시저장·게시) | `§3.4` |
| `PUT /api/posts/{id}` | (계약만 — 수정 화면은 다음 단위) | `§3.5` |
| `DELETE /api/posts/{id}` | (계약만) | `§3.5` |
| `POST /api/attachments` | 첨부 업로드 | `§4.1` |
| `GET /api/files/{id}` | 첨부 다운로드 (`/news/[slug]`·`/my/notices/[slug]`) | `§4.2` |

### ⚠️ 1. `publishedAt`은 nullable이어야 한다 — 응답 스키마 확인 필요

`§3.4`가 `publish: false` → `publishedAt = null`이라고 정해뒀는데,
`§3.2`(목록)·`§3.3`(상세) 예시에는 `publishedAt`이 항상 문자열로 나온다.
FE 타입을 `string | null`로 **정정했다**(`frontend/src/types/api.ts`).

- 백엔드 확인 필요: 임시저장 글을 `§3.2`/`§3.3`으로 조회할 때
  **필드를 생략하지 말고 `null`을 명시**해야 한다 (`§1.3` null 규칙)
- 함께 정해야 할 것: **임시저장 글이 `GET /api/posts` 목록에 나오는가?**
  스펙에 없다. FE는 지금 "나온다면 날짜 자리에 `임시저장`으로 표시"하도록
  만들어뒀고, 작성자 본인/임원에게만 보이는 게 맞다고 본다 — PM·백엔드 확인 필요

### 2. 첨부 업로드 — multipart 요청 형태

- `multipart/form-data`, 필드명 `file`, 파일 1개당 요청 1개 (여러 파일은 FE가
  순차 호출하며 파일별로 진행/실패를 표시한다)
- FE는 `Content-Type` 헤더를 **직접 넣지 않는다** (boundary는 브라우저가 생성).
  서버가 `Content-Type`을 엄격히 매칭한다면 boundary 포함 값을 받아들여야 한다
- 401 후 리프레시 재시도 시 FE가 **FormData를 새로 만들어 재전송**한다 —
  같은 파일이 두 번 도착할 수 있으니 서버는 이를 별개 업로드로 처리하면 된다
  (미연결 첨부는 24시간 후 정리되므로 문제되지 않는다)
- 응답은 `§4.1`대로 `{ id, filename, sizeBytes }`만 쓴다 — `contentType`은
  기대하지 않는다 (상세 조회 `§3.3`의 첨부에는 있다)
- **용량·확장자 제한 값이 스펙에 없다.** mock은 20MB로 막아뒀다. 서버 한도를
  알려주면 FE 안내 문구를 맞춘다. 초과는 `STORAGE_LIMIT`(409)로 가정했다

### 3. 첨부 다운로드 (`§4.2`) — 앵커 이동으로 호출된다

`§6.7`·`§6.8`과 같은 구조다. FE는 fetch가 아니라 `<a href>`로 이동한다
(302 → presigned를 따라가야 하므로).

- ⚠️ **top-level GET에서 쿠키 인증이 동작해야 한다**
- `Content-Disposition: attachment; filename=…` 필요 — cross-origin
  리다이렉트라 `<a download>` 값은 무시된다 (위 2026-08-24 #5와 같은 이유)
- 실패 시 브라우저에 날 응답이 그대로 노출된다 — 더 친절한 처리를 원하면
  방식을 별도로 정해야 한다

### 4. 인가 — `ARCHITECTURE.md §5.3` 인가 매트릭스에 추가될 행

| 경로 | 메서드 | 최소 권한 |
|---|---|---|
| `/api/posts` | POST | `L` |
| `/api/posts/{id}` | PUT · DELETE | `L` |
| `/api/attachments` | POST | `L` |
| `/api/files/{id}` | GET | **게시물 권한 상속** (로그아웃 → `UNAUTHORIZED`) |

FE는 `RequireLeader`로 화면 진입을 막지만 **UI 편의일 뿐이다.** 특히
`category`는 폼에서 오는 값이므로, `§3.1` 경고대로 **서비스 계층 단일 관문에서
작성 권한을 검사**해야 한다 (공개 분류를 골라 예산안을 공개하는 실수/우회 방지).

### 5. 본문 `body` — FE가 실제로 만들고 표시하는 노드 집합

`§3.3`은 "리치텍스트 JSON"까지만 정해뒀다. FE는 Tiptap(ProseMirror) JSON을
쓰며, **에디터가 만드는 것과 읽기 화면이 렌더하는 것이 정확히 같다**:

- 블록: `paragraph` `heading`(level 2·3) `bulletList` `orderedList` `listItem`
  `blockquote` `horizontalRule` `hardBreak`
- 마크: `bold` `italic` `underline` `strike` `link`(`href`)
- 코드 블록·이미지는 **의도적으로 제외** (본문 이미지용 계약이 없다)

서버는 이 JSON을 그대로 저장/반환하면 된다. 다만 **`href`는 서버에서도
검증하는 게 안전하다** (`javascript:` 등) — FE 렌더러는 허용 스킴만 통과시킨다.

- **미확정 사항**: 임시저장 글의 목록 노출 여부(#1), 첨부 용량·확장자 한도(#2),
  `body` JSON에 대한 서버측 스키마 검증 범위(#5)
- **관련 PR**: `feat/fe-rich-editor` 브랜치

---

## 2026-08-24 — 주보·다운로드 FE 구현 — 응답 규약 확인 7건

**상태**: 계약 변경 없음 (`SPEC_API.md §5`·`§6.7`·`§6.8` 그대로 구현). 다만 화면이
정상 동작하려면 **응답이 아래 조건을 지켜야 한다.** 대부분 스펙에 명시되지 않은
암묵적 전제라 확인이 필요하다.

### 주보 (`§5`)
| # | 요구사항 | 안 지키면 |
|---|---|---|
| 1 | **`pages`를 `pageNo` 오름차순으로 정렬** | FE는 배열 순서를 그대로 장 순서로 쓴다. 앞/뒷면이 뒤바뀌면 **주보를 읽을 수 없다** (`FR-BUL-05`가 업로드 시 순서 지정을 필수로 둔 것과 같은 이유) |
| 2 | **`pages[].width`/`height` 필수** | `<img width/height>`로 레이아웃 시프트를 막는다. 누락되면 이미지 로드 때 화면이 튄다 |
| 3 | **`pages[].url`은 장변 2048px** (`§5.1`) | 썸네일이 오면 글자가 읽히지 않아 화면 요구사항(`FR-BUL-03`)이 깨진다. **주보는 사진첩과 로딩 전략이 반대**다 — 썸네일 먼저가 아니라 큰 이미지를 바로 준다 |
| 4 | **presigned URL 만료 시간을 알려줄 것** | 주보를 보며 예배하는 화면이라 **오래 머문다.** 만료가 짧으면 도중에 이미지가 깨지므로 FE에 재조회 처리를 추가해야 한다. 지금은 만료를 모르는 상태로 만들었다 |

- `GET /api/bulletins`의 `page`는 **0-base로 가정**했고 `hasNext`로 [더 보기]를 노출한다
- 주보는 `next/image`를 쓰지 않고 `<img>`로 렌더한다 (presigned URL은 최적화 대상이 아님) → R2 도메인 이미지 설정 불필요

### 다운로드 (`§6.7`·`§6.8`)
| # | 요구사항 | 이유 |
|---|---|---|
| 5 | **`Content-Disposition: attachment; filename=…`을 §6.7·§6.8 둘 다에 설정** | FE는 **의도적으로 파일명을 주지 않는다.** 실제 응답은 R2(cross-origin)로 리다이렉트되어 `<a download>`의 값이 무시되고 서버 헤더가 파일명을 결정한다. 헤더가 없으면 브라우저가 이상한 이름으로 저장하거나 탭에서 열어버린다 |
| 6 | **`§6.8`은 앵커 이동(top-level GET)으로 호출된다** | fetch/XHR이 아니다 (ZIP 스트리밍을 메모리에 담지 않으려고). 따라서 ⚠️ **쿠키 인증이 top-level GET에서 동작해야 하고**, 실패 시 FE가 렌더할 JSON이 아니라 **브라우저에 날 응답이 그대로 노출된다.** 더 친절한 실패 처리를 원하면 별도 방식(예: 에러 코드와 함께 리다이렉트)을 정해야 한다 |
| 7 | **`ids` 30장 초과는 `VALIDATION_ERROR (field: ids)` 유지** | FE가 요청 전에 30장으로 막지만 그건 편의다. 서버 검증이 최종 방어선 |

- **미확정 사항**: 주보 presigned URL 만료 시간(#4), `§6.8` 실패 시 사용자에게
  보여줄 방식(#6)
- **관련 PR**: `feat/fe-bulletin`, `feat/fe-photo-download`

---

## 2026-08-24 — M3 사진첩 FE 구현 — 백엔드에 요청·확인할 것

**상태**: 대부분 계약 그대로 구현. **개선 제안 1건 + 응답 규약 확인 3건**이 있다.
`SPEC_API.md §6`의 `albums.list`·`albums.create`·`albums.photos`·`photos.report`를
mock/real 양쪽에 구현했다. 업로드(`§6.5`~`§6.6`)는 R2 presigned URL이 필요해
이번 범위 밖이다.

### 개선 제안 — `§6.4` 응답에 앨범 메타 추가
`GET /api/albums/{id}/photos` 응답에 앨범 제목·전체 장수가 없어서, 앨범 상세
화면이 제목과 "47장"을 표시하려고 **`GET /api/albums`(§6.1) 목록을 한 번 더
호출**한다. 목록을 거쳐 들어오면 캐시가 있어 괜찮지만, URL로 직접 진입하면
낭비 호출이다.

- 해결안 ①: `§6.4` 응답에 `album: { title, photoCount }` 추가
- 해결안 ②: `GET /api/albums/{id}` 단건 조회 신설
- 어느 쪽이든 FE 호출이 하나 줄어든다. **BE가 편한 쪽으로 정해주면 맞춘다**

### 응답 규약 확인 필요
| # | 요구사항 | 이유 |
|---|---|---|
| 1 | `§6.10` 신고 API의 `VALIDATION_ERROR`는 **반드시 `field: "reason"`** 포함 | FE가 그 필드 아래에 메시지를 붙인다. 빈 `reason`은 FE에서도 먼저 막지만 서버 검증이 최종 기준 |
| 2 | 없는 앨범은 `§6.4`에서 **`NOT_FOUND`(404)** | FE가 이 코드로 "앨범을 찾을 수 없습니다" 화면을 띄운다 |
| 3 | `§6.2` 앨범 생성은 **권한 `L` 미만에 `FORBIDDEN`** | FE는 버튼을 숨기지만 그건 편의일 뿐이다 (`WORKPLAN §5.1`) |

### ⚠️ 배포 설정 — `API_ORIGIN`이 실제로 필요해졌다
FE의 `real.ts`는 브라우저에서는 상대 경로(`/api/...`)를 쓰지만, **서버 렌더링
중에는 절대 URL이 필요하다** (Node의 `fetch`는 base가 없으면
`TypeError: Failed to parse URL`을 던진다). `.env.example`에 있던 서버 전용
`API_ORIGIN`을 이제 실제로 읽는다.

- **배포 환경(Vercel)에 `API_ORIGIN`을 설정해야** 공개 페이지 SSR이 동작한다.
  없으면 공개 공지가 초기 HTML에 안 들어가 검색 유입에 불리하다 (M1의 핵심 가치)
- ⚠️ **서버 렌더링 시 쿠키 전달은 아직 구현하지 않았다** — 공개 데이터 SSR만
  해결된 상태다. 회원 데이터를 서버에서 읽어야 할 일이 생기면 쿠키 forwarding이
  별도로 필요하다

### R2 URL 형태 확정 시 함께 정해야 할 것
`next/image`로 R2 presigned URL을 쓰려면 `next.config.ts`에
`images.remotePatterns`로 호스트를 등록해야 한다. 더 중요한 문제는 **presigned
URL의 쿼리스트링이 매번 바뀌어서 Next 이미지 옵티마이저가 항상 캐시 미스**가
난다는 점이다. 그래서 사진 목록은 `next/image`를 쓰지 않고 `<img>`로 처리했다
(thumb이 이미 640px WebP다). 앨범 커버만 `next/image`를 쓰므로, **R2 호스트가
정해지면 `remotePatterns` 등록 또는 `unoptimized` 여부를 함께 결정해야 한다.**

- **미확정 사항**: 위 개선 제안의 선택지(① vs ②), R2 호스트 주소
- **관련 PR**: `feat/fe-photo-assets`, `feat/fe-album-list`, `feat/fe-photo-grid`,
  `fix/fe-prod-build`

---

## 2026-08-24 — 401 자동 재시도 구현 — 백엔드 응답에 대한 요구사항

**상태**: 계약 변경 없음. `SPEC_API.md §12.2`의 401 처리 흐름을 FE에 구현했다
(`frontend/src/lib/api/real.ts`). 다만 이 로직이 동작하려면 **백엔드 응답이
아래 조건을 지켜야 한다.**

- **내용 — BE가 맞춰줘야 하는 것**
  1. **액세스 토큰 만료는 반드시 `401` + `{"error":{"code":"UNAUTHORIZED"}}`**로
     응답해야 한다. FE는 `code === "UNAUTHORIZED"`를 보고 리프레시를 시도한다.
     403이나 다른 코드로 오면 재시도가 동작하지 않는다
  2. **`POST /api/auth/refresh`는 리프레시 쿠키만으로 동작**해야 한다 (만료된
     액세스 토큰이 함께 실려와도 무시). FE는 만료된 토큰을 제거할 방법이 없다
     (httpOnly 쿠키라서)
  3. 리프레시 실패 시에도 `401 UNAUTHORIZED`로 응답해야 한다
- **왜 필요한지**: 액세스 토큰이 30분이라 회원이 화면을 켜둔 채 30분이 지나면
  모든 요청이 실패한다. 자동 갱신이 없으면 30분마다 재로그인해야 한다
- **FE가 처리한 것** (BE가 신경 쓸 필요 없음)
  - 재시도는 **정확히 1회**. 재시도 후 또 401이면 그대로 실패 처리
  - `/auth/refresh`·`/auth/login`은 재시도 대상 제외 (무한 재귀 / 로그인 실패를
    토큰 만료로 오해하는 문제 방지)
  - **동시 401은 single-flight로 묶어 리프레시를 1번만 보낸다.** `SPEC_API.md §2.3`대로
    리프레시 토큰이 **회전**하므로, 병렬 요청이 각자 리프레시를 보내면 두 번째부터는
    이미 폐기된 토큰을 쓰게 되어 정상 세션이 끊긴다. ⚠️ **BE도 회전 구현 시
    "직전 토큰 재사용"을 곧바로 세션 무효화로 처리하면 경합에 취약하다** —
    짧은 그레이스 기간을 두거나, 최소한 이 케이스를 인지하고 테스트해둘 것
- **미확정 사항**: 없음
- **⚠️ 검증 상태**: **FE 단독으로는 검증 불가.** mock에는 토큰 개념이 없어서
  `?mock=session-expired`로 "세션 만료 → `/login` 이동"만 확인했다. 실제
  401 → 갱신 → 재시도 왕복은 **통합 #2에서 최우선으로 확인해야 한다**
- **관련 PR**: `feat/fe-token-refresh` 브랜치

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
