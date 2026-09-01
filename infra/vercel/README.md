# Vercel 배포 설정 — 프론트엔드를 URL로 열기

**사용자가 실제로 보는 것은 이쪽입니다.** Render는 그 뒤에서 JSON을 줍니다
([`../../docs/ops/FLOW.md`](../../docs/ops/FLOW.md) `[8]`).

담당: PM/인프라 (`server_develop`)
관련: [`../render/README.md`](../render/README.md)(백엔드) ·
[`../../docs/ops/COST_GUARDRAILS.md`](../../docs/ops/COST_GUARDRAILS.md)(과금 방지) ·
[`../../docs/spec/ARCHITECTURE.md`](../../docs/spec/ARCHITECTURE.md) §9(환경변수)

---

## 0. 지금 배포하면 무엇이 보이나

`NEXT_PUBLIC_USE_MOCK=1`(현재 값)로 배포하면 **백엔드를 호출하지 않고 mock
데이터로 화면 전체가 동작합니다.** 지금까지 만든 화면을 URL로 확인하는 목적에
맞습니다.

| | |
|---|---|
| ✅ 공개 페이지 (홈·소개·예배와모임·오시는길·말씀·소식·새가족등록) | 정상 |
| ✅ 로그인·회원 화면·관리 화면 | mock으로 동작 |
| ⚠️ **사진첩 이미지** | **깨져 보입니다** — 아래 §4 이유 (의도된 것) |
| ✅ 주보 이미지 | 정상 (PLACEHOLDER 생성물이라 배포에 포함) |

> ### ✅ 2026-08-27 배포 완료 — 실측값
>
> | 항목 | 값 |
> |---|---|
> | **고정 주소** | `https://light-homepage-light-ba18.vercel.app` |
> | 브랜치 별칭 | `light-homepage-git-develop-light-ba18.vercel.app` |
> | **접근 제어** | 🔒 **Deployment Protection(SSO) 유지** — Vercel 로그인한 사람만 (PM 결정) |
> | `sitemap.xml` | ✅ 절대 주소 정상 |
>
> ⚠️ 배포별 URL(`light-homepage-<해시>-...`)은 **다음 배포에 바뀝니다.** 문서나
> 환경변수에 넣지 마세요.

---

## 1. 순서대로 — 최초 1회

> ### ⚠️ ⓪ 먼저 — **카드를 등록하지 마세요**
>
> Vercel Hobby는 결제 수단 없이 쓸 수 있습니다. **결제 수단이 없으면 한도를
> 넘겨도 과금이 아니라 중단으로 나타납니다** — 이 프로젝트의 1차 방어입니다
> ([`../../docs/ops/COST_GUARDRAILS.md §0`](../../docs/ops/COST_GUARDRAILS.md)).

### ① 프로젝트 생성

https://vercel.com → Add New → Project → 이 저장소 연결

| 항목 | 값 |
|---|---|
| Framework Preset | **Next.js** (자동 감지됨) |
| **Root Directory** | **`frontend`** ← 🔴 이걸 안 하면 빌드가 실패합니다 |
| Build Command | 기본값 (`next build`) |
| Production Branch | **`develop`** ← 백엔드와 같은 브랜치 (`CICD.md §5.1`) · 🔴 **설정 화면에서 값을 눈으로 확인하세요** — §2⓪ |

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

## 2. 확인 — 🔴 배포마다 이 셋을 하세요

### ⓪ 🔴 **지금 서빙되는 것이 어느 커밋인가** — 이것부터

**①②보다 먼저 합니다.** 이게 없으면 ①②의 결과가 **어느 코드에 대한
결과인지 알 수 없습니다.**

Vercel → 프로젝트 첫 화면 → **Production Deployment** 카드 (또는 Deployments
탭에서 맨 위 행 클릭 → **Source**)에서 **브랜치와 커밋 해시**를 읽습니다.

```bash
# 그 해시가 방금 머지한 커밋과 같은지 대조한다
git log --oneline -1 origin/develop
```

| 관찰 | 판정 |
|---|---|
| 해시가 `origin/develop` HEAD와 같다 | 🟢 지금 보는 것이 최신 코드다 — ①②로 간다 |
| 해시가 **더 오래됐다** | 🔴 **최신 코드가 서비스되고 있지 않다.** ①②를 해도 의미가 없다 → §2.5 |
| Environment가 `Preview` | 🔴 프로덕션 별칭이 갱신되지 않았다 → §2.5 |

> ### 🔴 2026-08-28 — **13커밋 동안 프로덕션이 동결돼 있었습니다**
>
> 어제 실인물 사진을 `public/` 밖으로 뺀 뒤(#94) "머지했으니 고쳐졌다"고
> 기록했습니다. 오늘 브라우저로 실측하니 `/photos/retreat-2026/thumb/p001.webp`가
> **여전히 200**이었습니다.
>
> 원인: **Production Branch가 `main`으로 설정돼 있었습니다.** `main`은
> develop보다 **283커밋 뒤처진 문서 전용 브랜치**로, `frontend/`가 아예 없습니다.
> Vercel은 프로젝트 연결 시 **첫 배포를 브랜치와 무관하게 Production으로
> 표시**하므로 `6e47df3`(#89)이 Production이 됐고, 그 뒤 develop 머지는 **전부
> Preview**가 되어 **프로덕션 별칭이 어제 오전 상태로 영구 동결**됐습니다.
>
> 반영되지 않은 채 지나간 것: `d0f8a0f`(#94 **사진 제거**) ·
> `35317bc`(#92 빌드 수정) 등 **13커밋 전부**.
>
> ⚠️ **§1①에는 `Production Branch: develop`이 처음부터 적혀 있었습니다.**
> 문서가 틀린 게 아니라, **문서에 적힌 값이 실제 설정과 같은지 대조한 적이
> 없었습니다.** `.vercelignore`(§2 아래) · Jenkins 시크릿 스캔과 **같은 실패
> 유형의 세 번째 사례**입니다 — 이번에는 "장치가 무효"가 아니라 **"장치가 켜져
> 있다고 믿었다"**입니다.
>
> → 그래서 이 ⓪가 생겼습니다. **머지 사실은 배포의 증거가 아닙니다.**
> `../render/README.md`가 "훅이 초록불인 것은 배포의 증거가 아니다"라고
> 적어둔 것과 같은 말인데, 프론트에서 같은 실수를 했습니다.

### ① 화면이 뜨는지

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<프로젝트명>.vercel.app/
# → 200
```

브라우저로 열어 홈·`/welcome`·`/news`가 보이면 성공입니다.

### ② 🔴 실인물 사진이 배포되지 않았는지 (개인정보)

**`frontend/mock-assets/photos/retreat-2026/`에는 얼굴이 식별되는 실제 인물
사진 47장(95개 파일)이 있습니다.** 배포에서 서빙되면 "회원 사진은 로그인 뒤에
둔다"는 결정이 우회됩니다.

**2026-08-27부터 코드가 막습니다** — 자산이 `public/` 밖에 있고,
`/mock-assets/*` route handler가 `NODE_ENV === "production"`이면 404를 줍니다.
그래도 배포마다 확인하세요.

```bash
# 앞의 둘은 404, 마지막은 200이어야 합니다
curl -s -o /dev/null -w "%{http_code}
" https://<주소>/mock-assets/photos/retreat-2026/thumb/p001.webp
curl -s -o /dev/null -w "%{http_code}
" https://<주소>/photos/retreat-2026/thumb/p001.webp
curl -s -o /dev/null -w "%{http_code}
" https://<주소>/icons/icon-192.png
```

| 앞의 둘 | 마지막 | 판정 |
|---|---|---|
| 404 | 200 | 🟢 정상 — 사진만 정확히 차단됨 |
| **200** | 200 | 🔴 **사고** — 즉시 배포 중단 |
| 404 | **404** | ⚠️ `public/` 전체가 배포되지 않음 (아이콘·이미지도 깨짐) |

> 🔴 **마지막 줄(아이콘 200)이 반드시 필요합니다.** 그게 없으면 "차단됨"과
> "배포 자체가 안 됨"을 구별할 수 없습니다 — 2026-08-27에 실제로 이 함정에
> 빠졌습니다. 사이트 전체가 404인 상태에서 자산 404를 보고 "제외됐다"고
> 판단할 뻔했습니다.

> ### 🔴 `.vercelignore`(옛 2안)는 동작하지 않았습니다 — 기록으로 남깁니다
>
> 2026-08-25부터 `frontend/.vercelignore`에 `public/photos`를 적어두고
> **"배포에서 제외됐다"고 믿고 있었습니다.** 2026-08-27 첫 배포에서 실측한
> 결과 `/photos/retreat-2026/thumb/p001.webp`가 **200으로 서빙됐습니다.**
> **Git 연동 배포에서는 그 파일이 효과가 없습니다.**
>
> 그 이틀 동안 유일한 방어는 **배포가 없었다는 사실**과, 배포 후에는
> **Deployment Protection(SSO)**뿐이었습니다.
>
> → 1안(자산을 `public/` 밖으로 + route handler)으로 전환했고
> `.vercelignore`는 제거했습니다. **무효가 확인된 장치를 남겨두면 다음 사람이
> 또 믿습니다.**

---

## 2.5 🔴 최신 코드가 서비스되지 않을 때

### 원인부터 — 설정 두 개를 **실제 화면에서** 읽습니다

| 확인할 곳 | 있어야 하는 값 |
|---|---|
| Settings → Environments → **Production** → **Branch Tracking** | **`develop`** |
| (구 UI) Settings → **Git** → **Production Branch** | **`develop`** |

**문서의 값을 믿지 말고 화면의 값을 읽으세요.** 이 항목이 §1①에 적혀 있는데도
실제 설정은 `main`이었습니다 (§2⓪).

### ⚠️ 고칠 때 하면 안 되는 것 두 가지

Branch Tracking을 고쳐도 **그것만으로는 재배포되지 않습니다.** 그리고 급한
마음에 아래 둘 중 하나를 누르면 상황이 더 나빠집니다.

| 하면 안 되는 것 | 왜 |
|---|---|
| 기존 배포 **Redeploy** | **그 배포의 커밋을 그대로 다시 빌드합니다.** 옛 커밋을 재배포하면 §2②가 막으려던 자산이 **다시 올라갑니다** |
| Preview → **Promote to Production** | 승격은 **다시 빌드하지 않습니다.** Preview 환경변수로 빌드된 결과물이 프로덕션이 됩니다 — `NEXT_PUBLIC_USE_MOCK`은 **빌드 타임에 코드에 박히는 값**이라 두 환경의 값이 다르면 잘못된 모드가 서비스됩니다 |

→ **새 커밋을 `develop`에 푸시해 새로 빌드하는 것만이 안전합니다.**
그 뒤 §2⓪로 커밋 해시를 대조합니다.

### 🔴 옛 배포는 살아 있습니다 — 지워야 합니다

**Vercel은 배포마다 고유 URL을 영구 보존합니다.** 새 배포를 올려도 사진이 든
옛 배포는 **자기 URL에서 계속 서빙합니다.**

- [ ] 새 Production 배포가 생긴 뒤, **`d0f8a0f`(사진 제거) 이전 배포를 전부
      삭제**한다 (Deployments → 해당 행 → `⋯` → Delete)
- [ ] 현재 Production 배포는 삭제할 수 없습니다 — **새 배포를 먼저** 올립니다

> ⚠️ **"보호가 걸려 있으니 괜찮다"로 끝내지 않습니다.** Deployment Protection의
> 적용 범위(Standard Protection이 무엇까지 덮는지)를 따져서 안전하다고 결론내는
> 것은, 이 파일이 세 번 틀린 바로 그 추론 방식입니다. **자산을 지우는 쪽이
> 설정을 해석하는 쪽보다 확실합니다** — `mock-assets` route handler를 플랫폼
> 설정 대신 코드로 만든 것과 같은 판단입니다.

---


## 3. 배포하기 전에 알아둘 것 — 공개 URL입니다

`*.vercel.app`은 **URL을 아는 누구나 접근할 수 있습니다.** 아래를 알고 배포하세요.

| 항목 | 상태 |
|---|---|
| mock 데이터에 실명·연락처 | ✅ **없음** (전수 확인 — 0건) |
| 자료 경로 색인 차단 | ✅ `robots.ts` + `next.config.ts`의 `X-Robots-Tag` 이중 |
| 실인물 사진 배포 제외 | ✅ **코드로 차단** — `public/` 밖 + route handler가 배포에서 404 (§2②). ~~`.vercelignore`~~ 는 무효 판명 |
| ✅ **새가족 등록 폼** | **2026-08-28 해소** — 배포된 mock 빌드에서는 폼 대신 안내를 띄웁니다(`RegisterForm.tsx`). `NEXT_PUBLIC_USE_MOCK=0`으로 BE를 연결하면 폼이 그대로 살아납니다 |
| ⚠️ `/welcome`·`/location` | `❓ 확인 필요` 플레이스홀더가 화면에 떠 있습니다 (드림센터 사진·주차 위치 등) |
| ⚠️ 개인정보 처리방침 문구 | **미확정** (회원제 법적 요구 — `handover/2026-08-26.md §2.1`) |

> ### 🔒 PM 결정 2026-08-27 — **Deployment Protection을 유지한다**
>
> Vercel 로그인한 사람만 접근할 수 있는 상태로 둡니다. 위 ⚠️ 세 항목(새가족 폼 ·
> 플레이스홀더 · 개인정보 처리방침)이 미해결이고, 지금 목적은 **작업한 화면을
> 확인하는 것**이기 때문입니다.
>
> **보호를 풀기 전에 처리할 것**
> - [x] ~~새가족 등록 폼~~ — **2026-08-28 완료.** 배포된 mock 빌드에서는 안내로 대체
> - [ ] `/welcome`·`/location`의 `❓ 확인 필요` 플레이스홀더
> - [ ] 개인정보 처리방침 문구 (회원제 법적 요구)
> - [ ] 🔴 **사진이 든 옛 배포 삭제** (§2.5) — 새 배포를 올려도 옛 배포 URL은
>       살아 있습니다. **이걸 빼먹고 보호를 풀면 사진 수정이 무의미해집니다**
> - [ ] §2⓪ 커밋 해시 대조 → §2② 자산 확인 재실행 (보호가 없으면 curl 실측이
>       가능해집니다)
>
> ⚠️ **BE에게 화면을 보여줘야 하면** Vercel 팀에 초대하는 편이 보호를 푸는 것보다
> 안전합니다.

---

## 4. 사진첩 이미지가 깨져 보이는 이유 — 의도된 것입니다

실인물 사진 자산이 **`public/` 밖(`frontend/mock-assets/`)에 있고**,
`/mock-assets/*` route handler가 **배포에서 404**를 주기 때문입니다.
**개인정보가 데모 완성도보다 우선입니다.**

`DECISIONS.md` 2026-08-24가 남겨둔 3안 중 **1안을 채택했습니다** (PM 결정 2026-08-27).

| 안 | 내용 | 결과 |
|---|---|---|
| **1안** ★ 채택 | 자산을 `public/` 밖으로 + mock 전용 route handler | 데모에서 사진첩이 깨진다. **코드가 막으므로 플랫폼 설정에 의존하지 않는다** |
| ~~2안~~ | `.vercelignore`로 제외 | 🔴 **무효 판명** — Git 연동 배포에서 효과 없음 (§2②) |
| 3안 | 얼굴 없는 대체 이미지로 교체 | 데모도 정상으로 보인다. 단 **실제 사진을 지워야 한다** — PM이 보류 |

> ⚠️ **게이트가 `NODE_ENV`입니다** (`NEXT_PUBLIC_USE_MOCK`이 아닙니다).
> 1안의 원안은 "`mock=1`일 때만 응답"이었는데, **지금 데모가 `mock=1`로 떠 있어서**
> mock 여부로 게이트하면 그대로 서빙됩니다. 배포 전체를 막으려면 `NODE_ENV`여야
> 합니다.

**주보는 `public/`에 그대로 있습니다** — "PLACEHOLDER" 문구가 찍힌 생성물이고
개인정보가 아닙니다. 데모에서 주보 뷰어는 정상으로 보입니다.

**실서비스에서는 어차피 이 자산을 쓰지 않습니다** — 사진은 R2 presigned
URL(만료됨)로 서빙됩니다 (`SPEC_API §6.4`).

### 데모에서도 사진을 보이게 하려면

3안(대체 이미지 교체)으로 전환하면 됩니다. `mock.ts`가
`/mock-assets/photos/retreat-2026/{thumb,view}/{slug}.webp`를 참조하므로
**같은 파일명으로 교체하면 코드 변경이 0입니다.** 실제 사진을 지우는 결정만
남아 있습니다.

---

## 5. Render와 다르게 하는 것

| | Render (백엔드) | Vercel (프론트엔드) |
|---|---|---|
| Auto-Deploy | **`Off`** — 테스트 통과한 커밋만 | **`On`** (기본값 유지) |
| 왜 | 깨진 코드가 서버에 올라가면 API 전체가 죽는다 | **빌드가 실패하면 Vercel이 승격하지 않는다** — 이전 배포가 계속 서비스된다 |

**Vercel은 빌드 실패가 곧 서비스 중단이 아닙니다.** 그래서 Render처럼 트리거를
하나로 줄일 이유가 약합니다.

> ### ⚠️ 다만 이 성질은 **안전 장치가 아니라 침묵 장치**입니다
>
> "이전 배포가 계속 서비스된다"는 것은 곧 **"고친 것이 반영되지 않아도 사이트는
> 멀쩡해 보인다"**는 뜻입니다. 2026-08-28에 실제로 그렇게 됐습니다 — 사진 제거
> 수정이 13커밋 동안 프로덕션에 닿지 못했는데 **사이트는 정상으로 보였습니다**
> (§2⓪).
>
> 백엔드는 반대입니다: 배포가 안 되면 API가 죽어서 **바로 드러납니다.**
> 프론트는 드러나지 않습니다. **그래서 프론트에는 §2⓪(커밋 해시 대조)가
> 백엔드보다 더 필요합니다.** 그리고 **브랜치·PR마다 Preview 배포**가 생겨서
`develop`에 들어가기 전에 화면을 확인할 수 있습니다 — Hobby에서 무료입니다.

---

## 5.5 🔴 백엔드 PR에서 Vercel 체크가 실패합니다 — 반드시 처리하세요

2026-08-27에 BE의 PR #93에서 확인했습니다:

```
Vercel  fail  "GitHub couldn't verify an account for the commit."
```

**이 PR의 코드와 무관합니다.** Vercel이 커밋 작성자(BE)를 Vercel 계정과 연결하지
못해 빌드를 거부한 것입니다.

| | |
|---|---|
| 원인 | **Vercel Hobby는 팀원을 추가할 수 없습니다** (단일 사용자 플랜) |
| 결과 | **BE가 작성한 모든 PR에서 Vercel 체크가 계속 실패합니다** |
| 부수 문제 | **백엔드 전용 PR인데 Vercel이 빌드를 시도합니다** — Hobby 빌드 시간 낭비 |

> ### ⚠️ 이게 위험한 이유는 빌드 실패 자체가 아닙니다
>
> `docs/ops/CICD.md §4`가 **"CI ❌면 머지하지 않는다"**를 실질 게이트로 삼고 있습니다.
> **항상 빨간 체크가 하나 있으면 사람이 체크를 무시하기 시작합니다.**
> 그러면 진짜 실패도 함께 무시됩니다.
>
> 오늘 시크릿 스캔에서 "**늘 실패하는 검사는 곧 무시된다**"고 판단해 오탐을 고친
> 것과 같은 실패 모드입니다 (`COST_GUARDRAILS.md §3.1`).

### 처리 방법 ① — Ignored Build Step (PM 커밋의 frontend 무관 변경용)

**적용 완료 (2026-08-31)**: 대시보드가 아니라 저장소의
**`frontend/vercel.json` → `ignoreCommand`**로 넣었습니다. 저장소에 있으면
설정이 코드 리뷰를 거치고 이력이 남으며, 대시보드 로그인 없이도 관리됩니다.
(vercel.json의 ignoreCommand가 대시보드 설정보다 우선합니다.)

동작: **`frontend/` 변경이 없으면 빌드를 건너뜁니다.**

Root Directory가 `frontend`이므로, 그 디렉터리에 변경이 있는지만 봅니다:

```bash
git diff --quiet HEAD^ HEAD -- .
```

> ⚠️ **동작을 확인해야 합니다.** Vercel의 Ignored Build Step은 **종료 코드 0이면
> 빌드를 건너뜁니다**(직관과 반대입니다). 위 명령은 "변경 없음 → 0 → 건너뜀"이
> 되도록 쓴 것이지만, 실제로 그렇게 도는지 **백엔드 전용 커밋 하나로 시험해
> 확인하세요.** 반대로 동작하면 프론트 변경이 배포되지 않습니다.

**이건 Actions에 `paths` 필터를 둔 것과 같은 발상입니다** — 바뀐 쪽만 검증하고,
무관한 변경에는 체크를 만들지 않습니다 (`CICD.md §1.1`).

> 🔴 **정정 (2026-08-31, PR #112 실측)**: 처음에는 이 설정으로 "백엔드 전용
> PR에서는 Vercel 체크가 아예 생기지 않는다"고 기대했지만 **틀렸습니다.**
> ignoreCommand는 **배포가 만들어진 뒤** 평가되는데, Hobby 플랜의 author 권한
> 체크(`Git author kdy1668 must have access to the project on Vercel`)는
> **배포 생성 시점**에 거부합니다. 그래서 BE 계정 커밋에는 ignoreCommand가
> 돌기 전에 X가 찍혔습니다. BE 커밋의 X는 아래 ②가 처리합니다.
> 즉 ①이 실제로 처리하는 것은 **PM 커밋의 frontend 무관 변경**(docs·infra 등)뿐입니다.

### 처리 방법 ② — git.deploymentEnabled (BE 브랜치의 X 제거)

**적용 (2026-08-31)**: `frontend/vercel.json`에 브랜치별 자동 배포 차단을
추가했습니다:

```json
"git": {
  "deploymentEnabled": {
    "backend_develop": false,
    "*/be-*": false
  }
}
```

- **배포 시도 자체를 만들지 않으므로 GitHub 체크(X)도 생기지 않습니다** —
  author 체크까지 갈 일이 없습니다
- `*/be-*`는 minimatch 글롭: `feat/be-*`·`fix/be-*` 등 `INTEGRATION.md §6.4`
  명명 규칙의 모든 BE 하위 브랜치를 커버합니다 (`*`는 `/`를 넘지 않음).
  글롭 지원은 [공식 문서](https://vercel.com/docs/project-configuration/git-configuration)에서 확인
- 명시하지 않은 브랜치는 기본 `true` → develop 프로덕션 배포·FE 프리뷰는 영향 없음
- ⚠️ **설정 반영에는 머지 후 배포 1회가 필요할 수 있습니다** (Vercel이 최신
  배포의 설정을 참조). 이 설정을 넣는 PR 자체가 frontend/를 바꾸므로 develop
  머지 시 자연히 충족됩니다
- ⚠️ **평가 순서(deploymentEnabled vs author 체크)는 공식 문서에 명시가
  없습니다.** 머지 후 BE 푸시 1건으로 실측하세요

> 🔴 **실측 (2026-09-01, `feat/be-contract-v13` head `6388cf6`)**: **X가 여전히
> 떴습니다** (`Vercel: failure`). 단 원인은 평가 순서가 아니었습니다 —
> **`git.deploymentEnabled`는 배포되는 그 브랜치의 `vercel.json`에서 읽습니다.**
> `backend_develop`이 `develop`보다 7커밋 뒤처져 있어 BE 브랜치의
> `frontend/vercel.json`에는 `ignoreCommand`밖에 없었고, 설정이 없으니 배포가
> 그대로 시도돼 author 체크에서 막힌 것입니다.
>
> 즉 **②는 BE 브랜치에 설정이 내려간 뒤에야 효력이 있습니다.** 이 설정을
> develop에 머지하는 것만으로는 부족하고, `develop → backend_develop` 동기화가
> 반드시 선행돼야 합니다 (PR #123). "조건부 무시" 폴백은 **필요 없습니다** —
> ②가 틀린 게 아니라 아직 도달하지 않았을 뿐입니다.
>
> 최종 실측은 동기화 뒤 BE 푸시 1건으로 다시 합니다. 확인 명령:
> `gh api repos/gbw11/light-homepage/commits/<sha>/status --jq .statuses`
> — `Vercel` context가 **아예 없어야** 통과입니다

### 남는 경우

- **BE 브랜치가 `frontend/`를 건드리는 경우**: ②로 인해 프리뷰가 아예 만들어지지
  않습니다. 그 변경의 화면 확인은 develop 머지 후에 하거나, PM이 자기 브랜치로
  가져와 커밋합니다 (드물 것이라 발생 시 다시 봅니다)
- **FE PR에 BE가 커밋을 섞는 경우**: 브랜치 이름이 `*/fe-*`라 ②에 안 걸리고,
  author 체크에서 여전히 실패합니다. 섞지 않는 것이 원칙입니다

---

## 6. 비용

| | |
|---|---|
| 플랜 | **Hobby (무료)** · 결제 수단 미등록 |
| ⚠️ 조건 | **Hobby는 상업적 사용을 허용하지 않습니다.** 교회 홈페이지는 비상업으로 보는 것이 일반적이지만, **온라인 헌금·결제·광고가 붙는 순간 조건이 달라집니다** (`COST_GUARDRAILS.md §3.4`) |
| 배포 무게 | `public/photos` 7.2MB가 제외되어 그만큼 가볍습니다 |

---

## 7. 이 문서에서 확인된 것과 확인이 필요한 것

**실측으로 확인한 것 (2026-08-27)**
- ✅ 배포 성공 · 고정 주소 `light-homepage-light-ba18.vercel.app`
- ✅ `sitemap.xml`의 절대 주소 정상 (`NEXT_PUBLIC_SITE_URL` 반영)
- 🔴 **`.vercelignore`는 동작하지 않았다** — `/photos/.../p001.webp`가 200으로
  서빙되는 것을 브라우저로 확인. **추론이었던 항목이 반증됐다**
- ✅ 1안 적용 후 **프로덕션 서버에서 `/mock-assets/*` 404 · 개발 서버에서 200**
  (로컬에서 두 서버를 실제로 띄워 확인)
- ✅ 경로 탈출(`/mock-assets/../package.json`) 404
- mock 데이터에 실명·연락처 0건 · 프로덕션 빌드 2종 통과

**아직 확인해야 하는 것**
- **보호를 푼 뒤 §2② 재실행** — 지금은 SSO 때문에 외부에서 실측이 불가능하다.
  route handler가 막는 것은 로컬에서 확인했지만, **배포 환경에서의 실측은
  보호 해제 후에만 가능하다**
- Vercel Hobby의 현재 빌드 시간·대역폭 한도 (공급자가 조건을 바꾼다)
