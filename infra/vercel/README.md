# Vercel 배포 설정 — 프론트엔드를 URL로 열기

**사용자가 실제로 보는 것은 이쪽입니다.** Render는 그 뒤에서 JSON을 줍니다
([`../../docs/FLOW.md`](../../docs/FLOW.md) `[8]`).

담당: PM/인프라 (`server_develop`)
관련: [`../render/README.md`](../render/README.md)(백엔드) ·
[`../../docs/COST_GUARDRAILS.md`](../../docs/COST_GUARDRAILS.md)(과금 방지) ·
[`../../docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) §9(환경변수)

---

## 0. 지금 배포하면 무엇이 보이나

`NEXT_PUBLIC_USE_MOCK=1`(현재 값)로 배포하면 **백엔드를 호출하지 않고 mock
데이터로 화면 전체가 동작합니다.** 지금까지 만든 화면을 URL로 확인하는 목적에
맞습니다.

| | |
|---|---|
| ✅ 공개 페이지 (홈·소개·예배와모임·오시는길·말씀·소식·새가족등록) | 정상 |
| ✅ 로그인·회원 화면·관리 화면 | mock으로 동작 |
| ⚠️ **사진첩·주보 이미지** | **깨져 보입니다** — 아래 §4 이유 |

---

## 1. 순서대로 — 최초 1회

> ### ⚠️ ⓪ 먼저 — **카드를 등록하지 마세요**
>
> Vercel Hobby는 결제 수단 없이 쓸 수 있습니다. **결제 수단이 없으면 한도를
> 넘겨도 과금이 아니라 중단으로 나타납니다** — 이 프로젝트의 1차 방어입니다
> ([`../../docs/COST_GUARDRAILS.md §0`](../../docs/COST_GUARDRAILS.md)).

### ① 프로젝트 생성

https://vercel.com → Add New → Project → 이 저장소 연결

| 항목 | 값 |
|---|---|
| Framework Preset | **Next.js** (자동 감지됨) |
| **Root Directory** | **`frontend`** ← 🔴 이걸 안 하면 빌드가 실패합니다 |
| Build Command | 기본값 (`next build`) |
| Production Branch | **`develop`** ← 백엔드와 같은 브랜치 (`CICD.md §5.1`) |

> 🔴 **Root Directory를 `frontend`로 두는 것이 가장 흔한 실패 지점입니다.**
> 모노레포라 저장소 루트에는 `package.json`이 없습니다. 비워두면 Vercel이
> Next.js 프로젝트를 못 찾습니다.
>
> ⚠️ Render에서 `Dockerfile Path`를 Root Directory 기준으로 써야 했던 것과 같은
> 부류의 함정입니다 (`../render/README.md §1②`) — **모노레포에서는 "어디가
> 프로젝트 루트인가"를 매번 확인하세요.**

### ② 환경 변수 — 지금은 2개면 됩니다

Vercel 프로젝트 → Settings → Environment Variables

| 변수 | 값 | 언제 |
|---|---|---|
| `NEXT_PUBLIC_USE_MOCK` | **`1`** | 지금 (백엔드 미연결) |
| `NEXT_PUBLIC_SITE_URL` | `https://<프로젝트명>.vercel.app` | 지금 — OG 태그·sitemap의 절대 URL |

**`API_ORIGIN`은 지금 넣지 않아도 됩니다** — `mock=1`이면 백엔드를 호출하지
않습니다. FE·BE 연결 시점에 추가합니다:

```
API_ORIGIN=https://light-homepage.onrender.com
```

> ⚠️ **`API_ORIGIN`에 `NEXT_PUBLIC_`을 붙이지 마세요.** 붙이면 백엔드 주소가
> 클라이언트 번들에 그대로 박힙니다(`NFR-SEC-22`). 프록시는 서버에서만
> 이뤄집니다 — `next.config.ts`의 `rewrites`가 `/api/*`를 `API_ORIGIN`으로
> 넘깁니다.

### ③ 배포

Vercel은 **연결한 브랜치에 push되면 자동 배포**합니다. Render와 달리
Auto-Deploy를 끄지 않습니다 — 이유는 §5.

첫 배포는 Deploy 버튼으로 즉시 시작됩니다.

---

## 2. 확인 — 🔴 이 두 개는 반드시 하세요

### ① 화면이 뜨는지

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<프로젝트명>.vercel.app/
# → 200
```

브라우저로 열어 홈·`/welcome`·`/news`가 보이면 성공입니다.

### ② 🔴 실인물 사진이 **배포되지 않았는지** (개인정보)

**`frontend/public/photos`에는 얼굴이 식별되는 실제 인물 사진이 들어 있습니다**
(95개 파일 · 7.2MB). `public/`은 **인증 없이 정적 서빙**되므로, 배포에 포함되면
회원 전용 결정이 우회됩니다.

`frontend/.vercelignore`가 제외하도록 되어 있지만 — **그게 실제로 먹었는지
확인해야 합니다.**

```bash
# 셋 다 404여야 합니다. 200이면 즉시 배포를 중단하세요.
curl -s -o /dev/null -w "photos manifest : %{http_code}\n" https://<프로젝트명>.vercel.app/photos/retreat-2026/manifest.json
curl -s -o /dev/null -w "photos thumb    : %{http_code}\n" https://<프로젝트명>.vercel.app/photos/retreat-2026/thumb/p001.webp
curl -s -o /dev/null -w "bulletin        : %{http_code}\n" https://<프로젝트명>.vercel.app/bulletins/2026-08-10-p1.webp
```

> ⚠️ **`.vercelignore`의 위치가 Root Directory 기준인지 확인이 필요합니다.**
> `frontend/.vercelignore`에 있고 Root Directory가 `frontend`이므로 적용되는
> 것이 정상이지만, **이건 문서로 확인한 것이 아니라 추론입니다.** 위 curl 3개가
> 유일한 확실한 검증입니다.
>
> 200이 나오면: Vercel Settings에서 배포를 즉시 삭제하고, `.vercelignore`를
> 저장소 루트로 옮기거나 자산을 별도 조치한 뒤 다시 배포합니다.

---

## 3. 배포하기 전에 알아둘 것 — 공개 URL입니다

`*.vercel.app`은 **URL을 아는 누구나 접근할 수 있습니다.** 아래를 알고 배포하세요.

| 항목 | 상태 |
|---|---|
| mock 데이터에 실명·연락처 | ✅ **없음** (전수 확인 — 0건) |
| 자료 경로 색인 차단 | ✅ `robots.ts` + `next.config.ts`의 `X-Robots-Tag` 이중 |
| 실인물 사진 배포 제외 | ⚠️ `.vercelignore` 적용 — **§2②로 확인 필수** |
| ⚠️ **새가족 등록 폼** | mock으로 **동작합니다** — 방문자가 실제 개인정보를 입력할 수 있고, 그 정보는 아무 데도 저장되지 않습니다 |
| ⚠️ `/welcome`·`/location` | `❓ 확인 필요` 플레이스홀더가 화면에 떠 있습니다 (드림센터 사진·주차 위치 등) |
| ⚠️ 개인정보 처리방침 문구 | **미확정** (회원제 법적 요구 — `handover/2026-08-26.md §2.1`) |

> **판단이 필요한 지점**: 이 URL을 팀 내부 확인용으로만 쓸 것인지, 교인들에게
> 공유할 것인지에 따라 위 세 ⚠️의 무게가 달라집니다. **내부 확인용이면 지금
> 배포해도 됩니다.** 외부 공유 전에는 세 항목을 먼저 처리하세요.

---

## 4. 사진첩·주보 이미지가 깨져 보이는 이유

`.vercelignore`가 `public/photos`·`public/bulletins`를 배포에서 제외하기
때문입니다. **의도된 것입니다** — 개인정보가 우선입니다.

`.vercelignore` 자신이 이 상황을 예고해 두었습니다:

> ⚠️ Vercel에 mock 모드 데모를 배포 중이라면 그 데모에서는 사진이 안 보이게 된다
> — 그 경우 이 파일을 지우고 1안(mock 전용 라우트)으로.

**즉 이건 미결 결정(3안 중 택일)이 드러난 지점입니다**
(`handover/2026-08-26.md §2.1` — "개인정보 문제라 배포 전 필수, 1순위").

| 안 | 내용 | 대가 |
|---|---|---|
| **2안 (현재)** | `.vercelignore`로 제외 | 데모에서 사진첩이 깨져 보인다 |
| 1안 | mock 전용 라우트로 분리 | FE 작업 필요 |
| 3안 | 얼굴 없는 대체 이미지로 교체 | 자산 교체 작업 필요 + 실제 사진은 삭제 |

**실서비스에서는 어차피 이 자산을 쓰지 않습니다** — 사진은 R2 presigned
URL(만료됨)로 서빙됩니다. 즉 이 문제는 **데모 화면의 완성도** 문제이고,
개인정보 쪽은 2안으로 이미 막혀 있습니다.

---

## 5. Render와 다르게 하는 것

| | Render (백엔드) | Vercel (프론트엔드) |
|---|---|---|
| Auto-Deploy | **`Off`** — 테스트 통과한 커밋만 | **`On`** (기본값 유지) |
| 왜 | 깨진 코드가 서버에 올라가면 API 전체가 죽는다 | **빌드가 실패하면 Vercel이 승격하지 않는다** — 이전 배포가 계속 서비스된다 |

**Vercel은 빌드 실패가 곧 서비스 중단이 아닙니다.** 그래서 Render처럼 트리거를
하나로 줄일 이유가 약합니다. 그리고 **브랜치·PR마다 Preview 배포**가 생겨서
`develop`에 들어가기 전에 화면을 확인할 수 있습니다 — Hobby에서 무료입니다.

---

## 6. 비용

| | |
|---|---|
| 플랜 | **Hobby (무료)** · 결제 수단 미등록 |
| ⚠️ 조건 | **Hobby는 상업적 사용을 허용하지 않습니다.** 교회 홈페이지는 비상업으로 보는 것이 일반적이지만, **온라인 헌금·결제·광고가 붙는 순간 조건이 달라집니다** (`COST_GUARDRAILS.md §3.4`) |
| 배포 무게 | `public/photos` 7.2MB가 제외되어 그만큼 가볍습니다 |

---

## 7. 이 문서에서 확인된 것과 확인이 필요한 것

**저장소에서 확인한 것**
- `NEXT_PUBLIC_USE_MOCK=1` 프로덕션 빌드 통과 (2026-08-27)
- `public/photos` 95개 파일 7.2MB · `public/bulletins` 212KB
- `.vercelignore`가 두 경로를 제외 대상으로 지정
- mock 데이터에 실명·연락처 0건
- `robots.ts`가 `/photos`·`/bulletin`·`/meetings`·`/documents`·`/my`·`/admin` 차단
- `next.config.ts`의 `rewrites`가 `/api/*` → `API_ORIGIN` 프록시

**대시보드·배포 후에 확인해야 하는 것**
- 🔴 **`.vercelignore`가 Root Directory 기준으로 적용되는지** — §2②의 curl 3개가
  유일한 확실한 검증이다. 추론으로 넘기지 말 것
- Vercel Hobby의 현재 빌드 시간·대역폭 한도 (공급자가 조건을 바꾼다)
- 프로젝트가 실제로 저장소에 연결됐는지 (저장소에서는 알 수 없다)
