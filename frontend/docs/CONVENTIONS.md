# 프론트엔드 코딩 컨벤션

작업 루프는 [`WORKFLOW.md`](WORKFLOW.md), 컴포넌트 패턴은
[`COMPONENTS.md`](COMPONENTS.md)를 참고. 여기서는 코드 그 자체의 규칙만 다룬다.

---

## 1. 스택

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · TanStack Query ·
react-hook-form + zod. 새 의존성을 추가하기 전에 이 목록 안에서 해결되는지
먼저 확인한다.

---

## 2. 폴더 구조

```
src/
├─ app/          App Router 페이지·레이아웃 (라우팅 구조 = URL 구조)
├─ lib/
│  └─ api/       API 계층 (§3 참고) — 화면 코드가 접근하는 유일한 통로
└─ types/        API 응답/도메인 타입
```

- 라우트별 전용 컴포넌트는 해당 `app/**/` 디렉터리 안에 `_components/`로 둔다
  (Next App Router의 private folder 컨벤션 — 라우트로 인식되지 않음).
- 여러 라우트에서 재사용하는 공용 컴포넌트만 향후 `src/components/`로 분리한다
  (아직 없으면 만들지 않는다 — 재사용 시점에 만든다).

---

## 3. API 계층 — mock/real 스위치

```ts
// src/lib/api/index.ts
export const api: Api =
  process.env.NEXT_PUBLIC_USE_MOCK === "1" ? mockApi : realApi;
```

**화면 코드는 항상 `@/lib/api`에서만 import한다.** `./mock`이나 `./real`을
직접 import하면 이 스위치가 무력해지고, 백엔드 없이 개발하는 것이 불가능해진다.

- 새 API 엔드포인트를 쓰려면: `types.ts`에 인터페이스 추가 → `mock.ts`에
  더미 구현 추가 → `real.ts`에 실제 fetch 구현 추가. **셋 다 같이 늘어나야 한다.**
  mock만 있고 real이 비어있는 상태로 커밋하지 않는다.
- 에러는 `ApiError`/`isApiError`(`./error`)로 통일해서 처리한다.
- 백엔드 미완성 구간은 mock으로 먼저 화면을 완성한다 (`NEXT_PUBLIC_USE_MOCK=1`).
  실제 연동은 백엔드 엔드포인트가 준비된 후 `real.ts`만 채우면 되고, 화면
  코드는 건드릴 필요가 없어야 한다 — 그렇지 않다면 API 계층 설계가 새고 있다는
  신호다.

---

## 4. 데이터 페칭

- 서버 상태(API로 가져오는 데이터)는 **TanStack Query**로 관리한다. `useState` +
  `useEffect`로 직접 페칭하지 않는다.
- 폼 상태는 **react-hook-form + zod**로 관리한다. zod 스키마는 백엔드 계약
  (`docs/spec/SPEC_API.md`)과 필드명·검증 규칙을 맞춘다.

---

## 5. 스타일링 (Tailwind v4)

- 커스텀 CSS 파일을 새로 만들지 않는다 — Tailwind 유틸리티 클래스로 해결한다.
- 반복되는 클래스 조합이 3곳 이상 나오면, 그 시점에 컴포넌트로 추출한다
  (`COMPONENTS.md` §2).
- 색상·spacing 등 디자인 토큰은 `globals.css`의 Tailwind 테마 설정을 통해서만
  바꾼다. 컴포넌트 안에 임의의 hex 값을 박지 않는다.

---

## 6. 환경 변수

- `NEXT_PUBLIC_` 접두사는 **클라이언트 번들에 그대로 노출**된다. 서버 전용 값
  (`API_ORIGIN` 등)에는 절대 이 접두사를 붙이지 않는다 (`SPEC_NONFUNCTIONAL.md`
  NFR-SEC-22).
- 새 환경변수를 추가하면 `.env.example`에도 같이 추가한다 (`.env.local`은
  커밋 금지 — Secret Scan이 차단함, `.env.example`만 예외).

---

## 7. 타입스크립트

- `any` 금지. 타입을 모르면 `unknown`으로 받고 좁혀서 쓴다.
- API 응답 타입은 `src/types/api.ts`에 정의하고, 컴포넌트 props와 섞지 않는다.
- `next typegen`이 라우트 타입을 생성하므로, `type-check` 실행 전에 반드시
  이게 먼저 돈다 (`package.json`의 `type-check` 스크립트가 이미 그렇게 구성됨
  — 순서를 임의로 바꾸지 않는다).

---

## 8. 커밋 전 자가 점검

- [ ] `@/lib/api` 외에 `mock.ts`/`real.ts`를 직접 import한 곳이 없는가?
- [ ] `any` 타입을 새로 추가하지 않았는가?
- [ ] 새 환경변수를 `.env.example`에도 반영했는가?
- [ ] [`WORKFLOW.md`](WORKFLOW.md) §2의 검증 루프(lint/type-check/눈으로 확인)를
      통과했는가?
