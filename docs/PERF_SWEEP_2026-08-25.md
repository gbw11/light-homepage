# 프론트엔드 성능 스윕 — 2026-08-25

브랜치 `feat/fe-perf-sweep` (베이스: `feat/fe-a11y-brand-color`).
프론트 전체를 훑어 성능 결함을 수정한 기록이다. 단위마다 lint ·
type-check를 통과시키고 별도 커밋으로 남겼다 (`frontend/docs/WORKFLOW.md` 루프).

## 요약

| 구분 | 결과 |
|---|---|
| 삭제한 파일 | **없음** — 129개 소스 파일 전체 import 그래프를 풀어 확인. 미참조 파일 0, 미사용 의존성 0. 유일한 정리는 과잉 `export` 4곳과 25.9KB favicon 재생성 |
| 첫 화면(`/`) | 불필요한 클라이언트 청크 제거 (LandingGate 서버 컴포넌트화) |
| 네트워크 | react-query 중복 요청·포커스 재요청 폭주 제거, 아이콘 캐시 헤더 (`/news` ISR은 후속 정정으로 철회 — §13) |
| 렌더링 | 업로드 큐·사진 그리드·라이트박스·월례회 카운트다운의 과잉 리렌더 제거 |
| 번들 | tiptap 396KB를 관리자 글쓰기 초기 JS에서 분리 |
| 배포 | mock 실인물 사진 7.2MB를 Vercel 배포에서 제외 (초상권 결정 이행) |
| 잠재 버그 수정 | AlbumList가 presigned URL을 next/image에 넣던 것 (mock을 끄면 400) |

## 커밋별 상세

### 1. `f670016` LandingGate 서버 컴포넌트화
- `"use client"`가 붙어 있었지만 훅·이벤트 핸들러가 전혀 없었다. 제거.
- `LIGHT_WORDMARK` 상수를 `src/lib/viewTransition.ts`로 분리 — `/home`(서버
  컴포넌트)이 클라이언트 모듈에서 상수를 import해 그 청크 전체를 자기
  번들에 끌고 들어가던 것을 차단.

### 2. `4d5b228` react-query 기본 `staleTime: 60초`
- 기본 0이라 ① `/news` 서버 프리페치가 hydrate 직후 재요청되고(프리페치
  무의미) ② 창 포커스마다 무한스크롤 화면이 로드된 **모든 페이지**를 순차
  재요청했다(사진 47장 = 3페이지 연속 재요청).
- 신선도가 중요한 화면(월례회 열람 등)은 이미 `staleTime: 0` 명시라 무영향.

### 3. `2e307bb` mock 자산 Vercel 배포 제외 (`frontend/.vercelignore`)
- DECISIONS.md 2026-08-24 "배포 전 필수" 항목의 **2안 스톱갭**. 얼굴 식별
  가능한 실인물 사진 47장(7.2MB)이 `public/` 무인증 서빙으로 노출되는 것을
  배포 단계에서 차단. ⚠️ Vercel에 mock 데모를 배포 중이면 그 데모의 사진이
  안 보이게 된다 — 그 경우 1안(mock 전용 라우트)으로 전환.

### 4. `7d69135` 캐시 헤더
- `/icons/*`에 `Cache-Control: immutable 1년` (기본 max-age=0이라
  내비게이션마다 재검증 왕복이 있었다).
- `images.minimumCacheTTL` 4시간 → 1년 (대상이 로컬 불변 이미지 3장뿐).

### 5. `43a2c2e` 서비스워커 v2 — 캐시 증식 결함 3건
- 내비게이션 캐시 키를 pathname으로 정규화 — `?utm_source=` 변형마다 HTML
  전체가 새 엔트리로 쌓였고, 읽기는 `ignoreSearch`라 구분해 꺼내지도 못했다.
- activate에서 상한 트리밍(정적 100 · 셸 30) — VERSION이 안 바뀌는 한 정적
  캐시가 배포마다 무한 증식했다.
- 정적 자산 조회를 자기 캐시로 한정.

### 6. `1207429` 업로드 큐 행 memo화
- 진행률 틱(150ms)마다 전체 행 리렌더 → 243장 큐 기준 초당 ~1,300행.
  `QueueRow`를 `memo`로 추출(훅이 항목 참조를 유지하고 있어 곧바로 유효),
  `onRetry` `useCallback` 고정, 상태별 filter 6회를 단일 순회로.

### 7. `1a9a802` PhotoGrid 최적화
- 선택 탭 한 번에 전체 타일 리렌더 → memo `PhotoTile`로 바뀐 1개만.
- 선택 목록+안내 문구를 리듀서로 원자화 — `setState` 업데이터 안에서 다른
  `setState`를 부르던 불순 코드 제거 (StrictMode에서 두 번 실행되는 자리).
- `photos` flatMap `useMemo`, `includes` O(n²) → `Set` 조회.

### 8. `b5276fb` Lightbox
- 화살표 키마다 window keydown 리스너가 재부착 → ref 패턴으로 1회 부착.
- 이웃 ±1장(2560px, 수백 KB) 숨김 프리로드 — 넘길 때 빈 화면 제거.

### 9. `4340f66` PostEditor(tiptap) 동적 로딩
- tiptap+ProseMirror는 빌드 최대 청크(396KB)인데 이미 관리자 글쓰기 2개
  라우트에만 실리고 있었다(공개 글 보기 `PostBodyView`는 tiptap 없이 직접
  렌더 — 잘 돼 있었음). 여기서 한 발 더: `EMPTY_POST_BODY`·`isPostBodyEmpty`를
  tiptap 없는 `postBody.ts`로 분리하고 에디터를 `next/dynamic`으로 미뤄
  글쓰기 화면의 초기 JS에서도 뺐다.

### 10. `70e02d3` 월례회 카운트다운 잎 컴포넌트 격리
- 뷰어: 1초 틱마다 화면 전체(페이지 이미지 포함) 리렌더 → 문구만.
  만료 순간에만 `onExpired`로 부모에 1회 알림 (만료 배너 동작 동일).
- 목록: 30초 틱마다 카드 20장 전체 → OPEN 카드의 남은 시간 문구만.

### 11. `48431e8` AlbumList 커버 `next/image` → `<img>`
- presigned URL을 next/image에 넣던 **유일한 규칙 위반**(COMPONENTS §6.1).
  `images.remotePatterns` 설정이 없어 mock을 끄는 순간 옵티마이저가 원격
  URL을 거부해 커버가 깨질 자리였다. 성능이자 실버그 예방.

### 12. `4ebaa51` 자잘한 정리
- `src/app/favicon.ico` 25,931B → 5,430B (icon-192에서 16+32px 재생성).
- tsconfig `target` ES2017 → ES2022 (Node 22 환경에서 불필요한 다운레벨).
- `globals.css` 미사용 토큰 2개 제거, 과잉 export 4곳 un-export,
  manifest.ts 낡은 색상 주석 정정.

### 13. `51667e3` `/news`·`/news/[slug]` ISR(5분)
- mock을 끄고 빌드하면 목록이 빌드 시점 결과로 영영 굳는 문제. 5분
  재생성으로 정적 서빙+신선도 확보. **회원 영역은 캐시가 곧 유출이라
  적용하지 않음.**
- ⚠️ **후속 정정 (같은 날, `feat/fe-public-read-model`)**: `/news`의 ISR과
  서버 prefetch는 **걷어냈다.** 백엔드가 없는 환경에서 정적 생성이 응답을
  기다리다 60초 타임아웃 3회로 CI의 `mock=0` 빌드가 죽었기 때문이다
  (`API_ORIGIN`이 없으면 `/api/**` rewrite가 비어 요청이 갈 곳을 잃는다).
  목록은 클라이언트에서 조회한다. `/news/[slug]`의 ISR은 dynamic 라우트라
  빌드에 관여하지 않으므로 그대로 유지된다.

## 의도적으로 보류한 것 (하지 말 것 아님 — 근거와 함께)

- **InstallBanner 지연 로딩**: 모듈 스코프에서 `beforeinstallprompt`를 잡는
  건 의도된 설계다 — 이 이벤트는 페이지 로드 직후 1회뿐이라 로딩을 미루면
  설치 프롬프트를 영영 놓친다. 몇 KB 절감과 기능 파손의 교환이라 보류.
- **SiteFooter 라우트 그룹 재구성**: `usePathname` 하나 때문에 클라이언트
  래퍼가 있지만, 없애려면 전체 페이지를 라우트 그룹으로 옮겨야 한다.
  비용 대비 이득이 작아 보류.
- **공개 페이지의 `GET /auth/me` 왕복**: 헤더가 로그인 상태를 표시하기 위해
  모든 공개 페이지 첫 로드에 인증 조회가 나간다. 없애려면 헤더 구조 개편이
  필요 — 별도 단위로.
- **이미지 리사이즈 Web Worker화**: 업로드 시 WebP 인코딩(장당 2회)이 메인
  스레드에서 돈다. `OffscreenCanvas`가 transferable이라 워커 이전이 어렵지
  않지만 규모가 있어 별도 단위로.
- **Accordion `<details>` 전환**: `/welcome`의 유일한 클라이언트 경계인데
  마크업·모션 변화가 있어 시각 확인이 필요한 별도 단위로.

## 스윕 중 발견한 기존 지뢰 (성능 아님, 후속 필요)

- ⚠️ **`/my/notices/[slug]`·`/my/documents/[slug]`는 서버에서
  `api.posts.get`을 호출하는데, API 계층 어디에도 쿠키 전달이 없다.**
  mock에서는 티가 안 나지만 `NEXT_PUBLIC_USE_MOCK=0`이면 백엔드가 익명
  요청을 받아 401 → 페이지가 깨진다. 목록 페이지들은 같은 이유로 서버
  prefetch를 안 한다고 주석까지 있는데 상세 페이지가 예외로 남아 있다.
  수정 방향: `next/headers`의 `cookies()`를 서버 요청에 전달하거나, 목록과
  같이 클라이언트 fetch로 전환. **mock 전환 전 필수.**

## 측정·검증 결과

- **빌드**: lint · type-check · `next build` 전 커밋 통과 (37 라우트).
- **tiptap 분리 확인**: 최적화 전에는 `/admin/posts/new`·`[id]/edit`의
  초기 로드가 tiptap 청크(396KB)를 참조했으나, 최적화 후에는 **어느 라우트의
  초기 로드도 참조하지 않는다** (client-reference-manifest 전수 검사) —
  에디터가 화면에 뜰 때 온디맨드 로드된다.
- **ISR 확인**: prerender-manifest에서 `/news`의 `revalidate: 300` 확인
  (⚠️ 이후 §13의 후속 정정으로 `/news`의 ISR은 철회됐다).
- **화면 검증** (mock, dev): `/`(워드마크 모션 동작 포함) · `/home` ·
  `/news` 목록 · `/my/photos` 앨범 목록(img 커버) · 앨범 상세 그리드 ·
  선택 모드(2장 선택→하단 바) · 라이트박스(화살표 3연타 → 5/47, Esc) ·
  `/my/meetings`(남은 시간 문구) 모두 눈으로 확인, 콘솔 에러 0.
- 총 청크 합계는 1,773KB → 1,769KB로 거의 동일 — 코드는 지운 게 아니라
  **로드 시점을 옮긴 것**이므로 합계가 아니라 라우트별 초기 로드가 준다.
