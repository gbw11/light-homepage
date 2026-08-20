# frontend — Next.js

**소유: 프론트엔드 담당자** (백엔드는 이 디렉터리를 수정하지 않습니다)

---

## 초기화 — 완료됨 (2026-08-20)

```bash
npx create-next-app@latest . \
  --typescript --tailwind --eslint --app \
  --src-dir --import-alias "@/*" --use-npm
```

| 항목 | 버전 |
|---|---|
| Next.js | **16.3.1** (App Router · **Turbopack 기본**) |
| React | 19.2 |
| Tailwind CSS | **v4** (CSS-first — `tailwind.config.ts`가 없습니다) |
| TypeScript | 5 (strict) |
| ESLint | 9 (flat config — `eslint.config.mjs`) |

> ⚠️ 문서는 Next.js 15 기준으로 작성됐지만 **16으로 초기화**했습니다.
> Turbopack이 기본이 되면서 `--no-turbopack` 플래그가 사라졌습니다.
> `next dev`가 `AGENTS.md`를 자동 생성/갱신하므로 삭제하지 마세요.

설치된 추가 의존성:
```bash
npm i @tanstack/react-query react-hook-form zod
```

**아직 안 한 것**
```bash
npm i -D @serwist/next serwist          # PWA (M4). Next 16 호환 여부 확인 필요
```
Pretendard 폰트는 `public/fonts/`에 self-host 후 `next/font/local`로 로드합니다.
현재는 시스템 한글 폰트 스택을 쓰고 있습니다 (`src/app/globals.css`).

---

## 현재 구조

```
frontend/
├─ src/app/          layout.tsx(메타데이터·lang=ko) · page.tsx(임시 홈) · globals.css
├─ src/lib/api/      index.ts(진입) · mock.ts · real.ts · types.ts · error.ts
├─ src/types/api.ts  ★ 백엔드 응답 타입 = API 계약
├─ next.config.ts    /api/** 프록시 + 회원영역 noindex 헤더
├─ .env.example      → .env.local로 복사해서 사용
└─ AGENTS.md         next dev가 자동 생성 (삭제 금지)
```

## 예정 구조

```
frontend/src/
├─ app/
│  ├─ (public)/       HOME · about · worship · welcome · location · notices · sermons
│  ├─ (auth)/         login · signup · signup/complete · pending
│  ├─ my/             회원 영역 (주보 · 사진첩 · 월례회 · 공지 · 내 정보)
│  ├─ admin/          운영 영역 (글작성 · 업로드 · 회원관리)
│  └─ manifest.ts · sitemap.ts · robots.ts
├─ components/
│  ├─ layout/         Header · Footer · MobileMenu · UserMenu
│  ├─ ui/             Button · Card · Section · Modal · Accordion · Tabs · Toast
│  ├─ home/           Hero · ThisWeek · WorshipTimes · ...
│  ├─ photos/         PhotoGrid · Lightbox · Uploader · DownloadBar
│  └─ Logo.tsx        ★ LIGHT 워드마크 (단일 컴포넌트로 분리)
├─ lib/
│  ├─ api/            index.ts(진입) · mock.ts · real.ts   ← ★ 아래 참조
│  ├─ auth.ts         세션 상태 · 역할 판별
│  └─ image.ts        브라우저 리사이즈 (2560 / 640)
├─ content/           site.ts · faq.ts · welcome.ts  (거의 안 바뀌는 값)
└─ types/             api.ts  (백엔드 응답 타입)
```

---

## ★ API 계층 규칙

```ts
// lib/api/index.ts
export const api = process.env.NEXT_PUBLIC_USE_MOCK === '1' ? mockApi : realApi;
```

- **`real.ts`를 직접 import하지 않습니다.** 항상 `lib/api`(index)만 씁니다
- 이 규칙 하나로 백엔드 없이도 화면을 완성할 수 있습니다
- **mock에 실패 케이스를 반드시 넣습니다**: `401` · `403` · `STORAGE_LIMIT` · 업로드 실패 · 빈 목록
  → 성공 경로만 만들면 통합 때 무너집니다
- 실패 케이스는 **쿼리스트링으로 강제**합니다 (`src/lib/api/mock.ts`)

```
?mock=unauthorized   401 UNAUTHORIZED
?mock=forbidden      403 FORBIDDEN
?mock=pending        403 PENDING_APPROVAL
?mock=storage        409 STORAGE_LIMIT
?mock=empty          빈 목록
```

- 새 엔드포인트는 `src/lib/api/types.ts`의 `Api` 타입에 **먼저 선언**합니다
  → mock·real 한쪽만 구현하면 타입 오류로 잡힙니다

---

## 환경 변수 (`.env.local` — 커밋 금지)

```bash
API_ORIGIN=http://localhost:8080     # 서버 전용. NEXT_PUBLIC_ 붙이지 않음
NEXT_PUBLIC_USE_MOCK=1               # 백엔드 미구현 구간은 1
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 프록시 설정

```ts
// next.config.ts
async rewrites() {
  return [{
    source: '/api/:path*',
    destination: `${process.env.API_ORIGIN}/api/:path*`,
  }];
}
```

브라우저가 항상 자기 출처로 요청하므로 **CORS 설정이 불필요**하고, httpOnly 쿠키가 서드파티 쿠키가 되지 않습니다.

---

## 실행

```bash
cp .env.example .env.local     # 1회
npm install                    # clone 직후 1회
npm run dev                    # localhost:3000
```

CI와 동일한 검사를 로컬에서 돌리려면:
```bash
npm run lint
npm run type-check             # next typegen + tsc --noEmit
npm run build
```

## 참고
- 화면 설계: [`../docs/WIREFRAME.md`](../docs/WIREFRAME.md)
- 협업 규칙: [`../docs/INTEGRATION.md`](../docs/INTEGRATION.md)
- 디자인 토큰: [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) §11
