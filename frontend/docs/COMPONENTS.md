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
