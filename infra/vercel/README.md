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

## 2. 확인 — 🔴 배포마다 이 둘을 하세요

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


## 3. 배포하기 전에 알아둘 것 — 공개 URL입니다

`*.vercel.app`은 **URL을 아는 누구나 접근할 수 있습니다.** 아래를 알고 배포하세요.

| 항목 | 상태 |
|---|---|
| mock 데이터에 실명·연락처 | ✅ **없음** (전수 확인 — 0건) |
| 자료 경로 색인 차단 | ✅ `robots.ts` + `next.config.ts`의 `X-Robots-Tag` 이중 |
| 실인물 사진 배포 제외 | ✅ **코드로 차단** — `public/` 밖 + route handler가 배포에서 404 (§2②). ~~`.vercelignore`~~ 는 무효 판명 |
| ⚠️ **새가족 등록 폼** | mock으로 **동작합니다** — 방문자가 실제 개인정보를 입력할 수 있고, 그 정보는 아무 데도 저장되지 않습니다 |
| ⚠️ `/welcome`·`/location` | `❓ 확인 필요` 플레이스홀더가 화면에 떠 있습니다 (드림센터 사진·주차 위치 등) |
| ⚠️ 개인정보 처리방침 문구 | **미확정** (회원제 법적 요구 — `handover/2026-08-26.md §2.1`) |

> ### 🔒 PM 결정 2026-08-27 — **Deployment Protection을 유지한다**
>
> Vercel 로그인한 사람만 접근할 수 있는 상태로 둡니다. 위 ⚠️ 세 항목(새가족 폼 ·
> 플레이스홀더 · 개인정보 처리방침)이 미해결이고, 지금 목적은 **작업한 화면을
> 확인하는 것**이기 때문입니다.
>
> **보호를 풀기 전에 처리할 것**
> - [ ] 새가족 등록 폼 — 방문자가 실제 정보를 입력할 수 있는 상태
> - [ ] `/welcome`·`/location`의 `❓ 확인 필요` 플레이스홀더
> - [ ] 개인정보 처리방침 문구 (회원제 법적 요구)
> - [ ] §2② 자산 확인 재실행 (보호가 없으면 실측이 가능해집니다)
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
