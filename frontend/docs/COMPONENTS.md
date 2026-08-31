# 컴포넌트 패턴

코딩 컨벤션 전반은 [`CONVENTIONS.md`](CONVENTIONS.md), 작업 진행 방식은
[`WORKFLOW.md`](WORKFLOW.md) 참고. 여기서는 컴포넌트를 어떻게 나누고
작성하는지만 다룬다.

---

## 1. 언제 컴포넌트로 쪼개는가

- **3곳 이상**에서 같은 마크업/로직이 반복되면 그 시점에 추출한다. 미리
  만들지 않는다 (`WORKFLOW.md`의 "필요한 시점에 만든다" 원칙과 동일).
- 한 파일(`page.tsx` 등)이 **화면에서 구분되는 영역 3개 이상**을 한 번에
  다루고 있으면, 영역 단위로 하위 컴포넌트로 쪼갠다 — 파일 하나가 페이지
  전체 로직을 다 들고 있지 않게 한다.
- 페이지 전용 컴포넌트는 그 라우트의 `_components/` 아래에 둔다
  (`CONVENTIONS.md` §2). 여러 라우트에서 재사용될 때만 공용 위치로 승격한다.

## 2. Server Component vs Client Component

- **기본은 Server Component**다. `"use client"`는 아래 경우에만 붙인다:
  - `useState`/`useEffect`/이벤트 핸들러 등 상호작용이 필요할 때
  - TanStack Query, react-hook-form을 쓸 때
- `"use client"` 경계는 **가능한 한 트리 아래쪽으로** 내린다. 페이지 전체를
  클라이언트 컴포넌트로 만들지 않고, 상호작용이 필요한 최소 부분만 분리한다.

## 3. 로딩 / 빈 상태 / 에러 상태

TanStack Query를 쓰는 모든 화면은 아래 3개 상태를 **전부** 다룬다
(`WORKFLOW.md` 분해 단계의 4번). 하나라도 빠지면 그 단위는 완료가 아니다.

```tsx
if (isLoading) return <LoadingState />;
if (isError) return <ErrorState error={error} />;
if (data.length === 0) return <EmptyState />;
return <Content data={data} />;
```

- 401/403 등 인가 실패는 일반 에러와 다르게 처리한다 (로그인 유도 등) —
  `isApiError(error)`로 구분한다 (`CONVENTIONS.md` §3).

## 4. 접근성 (기본으로 지킬 것)

- 클릭 가능한 요소는 `button`/`a`로 만든다. `div`에 `onClick`만 붙이지 않는다.
- 폼 필드는 `label`과 연결한다 (`htmlFor` 또는 `label` 안에 input 포함).
- 키보드로 전체 흐름(포커스 이동, 폼 제출)이 가능한지 단위 완료 시 직접
  Tab으로 확인한다 (`WORKFLOW.md` §1의 6단계).

## 5. 반응형

- 모바일 우선으로 작성한다 (Tailwind 기본 브레이크포인트 없이 작성 후,
  필요한 지점에 `sm:`/`md:` 추가).
- 데스크톱/모바일 둘 다 `npm run dev`로 눈으로 확인한다 — 브라우저 개발자
  도구의 반응형 모드로 최소 1개 모바일 폭, 1개 데스크톱 폭 확인.

## 6. 이미지

### 6.1 `next/image` vs `<img>`

| 상황 | 무엇을 쓰나 |
|---|---|
| 정적 자산 (`public/`에 있고 URL이 안 바뀜) | **`next/image`** — 리사이즈·WebP 변환·lazy를 공짜로 얻는다 |
| **presigned URL** (사진첩·주보·첨부) | **`<img>`** + 사유 주석 |

presigned URL에 `next/image`를 쓰지 않는 이유:
- 쿼리스트링이 매번 바뀌어 **이미지 옵티마이저가 항상 캐시 미스**가 난다
- R2 호스트를 `next.config.ts`의 `images.remotePatterns`에 등록해야 한다
- 서버에서 이미 적정 크기(썸네일 640px 등)로 만들어 두므로 재최적화가 무의미하다

`<img>`를 쓸 때는 lint 규칙을 끄게 되므로, **왜 껐는지 주석으로 남긴다.**

### 6.2 ⚠️ `priority`는 쓰지 않는다 (Next 16에서 deprecated)

```tsx
// ✗ Next 16.0.0에서 deprecated
<Image src="..." priority />

// ✓
<Image src="..." loading="eager" fetchPriority="high" />
```

above-the-fold 이미지에만 `eager`를 주고, 나머지는 기본값(lazy)에 맡긴다.
Lighthouse 90+ 예산이 있으므로(`docs/spec/WORKPLAN.md` 품질 게이트) 화면 밖
이미지를 eager로 올리지 않는다.

근거: `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md`
(버전이 올라가면 이 문서를 다시 확인한다 — `AGENTS.md`가 요구하는 절차다).

### 6.3 크기를 지정한다

`width`/`height`(또는 `fill` + 크기가 정해진 래퍼)를 항상 준다. 없으면 이미지가
로드되는 순간 레이아웃이 밀린다(CLS). API 응답에 크기가 오는 경우
(`Photo.width/height`, `BulletinPage.width/height`)는 그 값을 쓴다.

### 6.4 `alt`

- 내용을 전달하는 이미지: 무엇이 보이는지 한국어로 쓴다 (파일명이 아니다)
- **배경·장식용**: `alt=""`. 옆에 같은 내용의 실제 텍스트가 있으면 장식이다 —
  스크린리더가 같은 말을 두 번 읽지 않게 한다

### 6.5 회원 사진은 공개 페이지에 쓰지 않는다

`public/photos/`의 사진은 **얼굴이 식별되는 실제 인물**이다. 공개(검색 색인)
페이지에는 쓰지 않는다 — 근거와 예외(공개 허용 3장)는
`docs/records/DECISIONS.md` "수련회 실사진 공개 페이지 적용 범위" 항목에 있다.
크롭·확대로 특정 인물이 식별되게 만드는 것도 포함해서 금지다.
