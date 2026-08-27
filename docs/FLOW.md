# 코드가 사용자에게 닿기까지 — 전체 흐름

브랜치를 파는 것부터 방문자 화면에 보이기까지, **한 장으로 보는 지도**다.

각 단계의 설계 근거는 다른 문서에 있다. 여기는 **순서와 연결**만 다루고, 자세한
이유는 링크로 넘긴다. 중복해서 적으면 한쪽이 낡는다.

> **처음 읽는 사람은 §0 → §2만 보면 된다.** §3~§4는 문제가 생겼을 때 본다.

---

## 0. 한 장 요약

```
 [1] 브랜치를 판다              feat/fe-*  ·  feat/be-*  ·  feat/infra-*
        │                       base = 자기 통합 브랜치
        ▼
 [2] 작업 + 로컬 검증           FE: lint · type-check · build ×2
        │                       BE: ./gradlew test  (Postgres 필요)
        ▼
 [3] push                       GitHub Actions ─┬─ 변경 경로만 골라 실행
        │                                       └─ 앞선 실행은 취소 (분 절약)
        │                       Jenkins (PM 로컬 PC) ── 시크릿 스캔 · 병렬 검증
        ▼
 [4] PR                         ✅ CI 통과가 실질적 머지 게이트
        │                       [CONTRACT] · 루트/CI 변경 → 상대 승인
        ▼
 [5] 통합 브랜치 머지            frontend_develop · backend_develop · server_develop
        │
        ▼
 [6] develop 머지  ★여기가 배포 트리거★
        │
        ├── backend/ 변경 있음 ──▶ Actions: Postgres 16 + build(인가 매트릭스)
        │                              │
        │                              ✅ 통과 → Render Deploy Hook 호출
        │                              │
        │                              ▼
        │                     [7] Render가 이미지 빌드 → 기동
        │                         Docker → Flyway V1 → Tomcat → 헬스체크
        │                              │
        │                              ▼
        │                     https://light-homepage.onrender.com  (API 서버)
        │                              ▲
        └── frontend/ 변경 ──▶ Vercel   │ 서버사이드 프록시 (/api/* → API_ORIGIN)
                                 │      │
                                 ▼      │
                        [8] 사용자 브라우저 ─────┘
                                        └─▶ Neon (PostgreSQL, Singapore)

 [9] 상시 가동                  cron-job.org가 10분마다 깨워둔다 (06:00~24:00)
```

---

## 1. 등장하는 것들

### 브랜치 5개

| 브랜치 | 누가 | 무엇을 | 배포와의 관계 |
|---|---|---|---|
| `frontend_develop` | FE | 화면·컴포넌트·PWA·SEO·mock | — |
| `backend_develop` | BE | API·엔티티·인증·인가·테스트 | — |
| `server_develop` | BE(주)·인프라 | Docker·Render·Neon·CI·환경변수 | — |
| **`develop`** | 공동 | 위 셋이 모이는 곳 | ★ **여기 머지되면 배포된다** |
| `main` | — | "공개된 것" | 공개 시점에 배포 대상을 여기로 옮긴다 |

소유 범위의 정확한 정의는 [`INTEGRATION.md §6`](INTEGRATION.md).

### 외부 서비스 5개

| 서비스 | 역할 | 주소 |
|---|---|---|
| **Vercel** | 프론트엔드 (사용자가 보는 화면) | ⬜ 배포 준비 — 절차: [`infra/vercel/`](../infra/vercel/README.md) |
| **Render** | 백엔드 API 서버 | `light-homepage.onrender.com` |
| **Neon** | PostgreSQL | Singapore |
| **GitHub Actions** | CI + 배포 트리거 | 클라우드, 항상 동작 |
| **cron-job.org** | 슬립 방지 핑 | ⏸️ **개발 단계 중지** (동작 검증 완료) |

전부 무료 플랜이고, **왜 무료로 유지되는지와 그 장치**는
[`COST_GUARDRAILS.md`](COST_GUARDRAILS.md)에 있다.

> ⚠️ **Jenkins는 여섯 번째가 아니다.** PM 로컬 PC에서 돌고 **CI 검증 전용**이다.
> 배포에는 관여하지 않는다 — PC가 꺼져 있으면 배포가 멈추기 때문이다
> ([`DECISIONS.md`](DECISIONS.md) 2026-08-26).

---

## 2. 단계별

### [1] 브랜치를 판다

```bash
git checkout develop && git pull --ff-only origin develop
git checkout -b feat/fe-앨범-정렬        # 또는 feat/be-* · feat/infra-* · fix/* · docs/*
```

**base는 자기 통합 브랜치가 아니라 최신 `develop`으로 잡는 편이 안전하다.**
통합 브랜치가 뒤처져 있으면 나중에 머지할 때 남의 변경과 충돌한다. 실제로
2026-08-27에 `backend_develop`이 232커밋 뒤처진 상태에서 BE가 브랜치를 따
동기화 요청을 따로 보내야 했다.

### [2] 작업하고 로컬에서 검증한다

CI와 **같은 명령**을 돌린다. 여기서 통과하면 CI에서 깨질 일이 거의 없다.

**프론트엔드**
```bash
cd frontend
npm run lint
npm run type-check
NEXT_PUBLIC_USE_MOCK=1 npm run build
NEXT_PUBLIC_USE_MOCK=0 npm run build   # ★ 백엔드 없이도 통과해야 한다
```
> `mock=0` 빌드를 왜 또 하는가 — 서버 컴포넌트가 빌드 시점에 백엔드를 호출하려다
> 정적 생성이 터지는 부류의 버그를 mock 빌드로는 못 잡는다. 실제로 `/my/notices`에서
> 발생해 배포 빌드가 깨졌다.

**백엔드**
```bash
cd backend && ./gradlew test        # ⚠️ localhost:5432에 Postgres가 필요하다
```

### [3] push → CI

| | GitHub Actions | Jenkins |
|---|---|---|
| 어디서 | 클라우드 (항상 동작) | **PM 로컬 PC** |
| 역할 | 검증 + **배포 트리거** | 검증 전용 |
| 무엇을 | Postgres 16 + build/test · **시크릿 스캔** | 변경 경로 감지 · 병렬 검증 · Quality Gate |

**Actions는 바뀐 쪽만 돈다** — `frontend/**` 변경은 Backend CI를 돌리지 않는다.
그리고 같은 브랜치에 새 커밋이 오면 **앞선 실행을 취소**한다(`develop`은 제외).
둘 다 무료 분을 아끼는 장치다 ([`CICD.md §1.1`](CICD.md)).

### [4] PR

무료 Private 저장소라 브랜치 보호 규칙을 쓸 수 없다. **그래서 CI 상태 표시가
사실상의 머지 게이트다** ([`CICD.md §4`](CICD.md)).

| 조건 | 필요한 것 |
|---|---|
| API 계약 변경 | 제목에 **`[CONTRACT]`** + **상대 승인** |
| 루트 설정·CI 변경 | **상대 승인** |
| 남의 소유 파일 변경 | 승인 + [`BACKEND_HANDOFF.md`](BACKEND_HANDOFF.md)에 기록 |
| 새 환경변수 도입 | PR 본문에 한 줄 — **등록 전에 머지되면 배포된 서버가 기동에 실패한다** |

### [5] 통합 브랜치 머지 → [6] `develop` 머지

`develop`에 머지되는 순간이 **배포 시점**이다. `deploy` 잡의 조건은 셋이다:

```
github.event_name == 'push'              PR에서는 배포하지 않는다
github.ref == 'refs/heads/develop'       다른 브랜치는 배포하지 않는다
needs.build.outputs.skipped != 'true'    ★ 검증을 실제로 한 빌드에서만
```

세 번째가 중요하다. 경로 필터로 건너뛴 빌드는 초록불이어도 **아무것도 검증하지
않은 것**이라, 그대로 배포하면 테스트 게이트가 없는 배포가 된다.

> ⚠️ **`backend/` 변경이 없는 머지는 배포하지 않는다.** 프론트 전용 머지로 백엔드를
> 재기동할 이유가 없다.

### [7] Render가 빌드하고 기동한다

Actions는 **훅을 호출하는 것까지만** 한다. 그 뒤는 Render가 한다.

```
Deploy Hook 수신
   ↓
Docker 빌드   (Root Directory: backend / Dockerfile Path: Dockerfile)
   ├─ 1단계  eclipse-temurin:21-jdk-alpine + Gradle Wrapper → bootJar (테스트 제외)
   └─ 2단계  eclipse-temurin:21-jre-alpine + 폰트 + 비루트 + exec java
   ↓
기동         Flyway V1 적용 → Tomcat이 ${PORT}에 바인딩 → 헬스체크
   ↓
Health Check /actuator/health/alive 가 200이면 라이브
```

- **Dockerfile Path는 Root Directory 기준**이다. `backend/Dockerfile`로 적으면
  `backend/backend/Dockerfile`을 찾아 실패한다 — 2026-08-27에 실제로 겪었다
  ([`../infra/render/README.md §1②`](../infra/render/README.md))
- 첫 빌드는 캐시가 없어 약 5분. 이후 `src`만 바뀐 커밋은 의존성 레이어를 재사용한다
- **Auto-Deploy는 `Off`** — 트리거가 둘이면 테스트를 기다리지 않는 배포가 생긴다

### [8] 사용자에게 보이기

**사용자가 보는 것은 Vercel이고, Render는 그 뒤에서 JSON을 준다.**

> ⬜ **2026-08-27 현재 Vercel에 배포된 적이 없다.** 설정 절차는
> [`../infra/vercel/README.md`](../infra/vercel/README.md)에 있다.
> 🔴 배포 후 **실인물 사진이 배포되지 않았는지 curl로 확인**해야 한다(그 문서 §2②).

```
브라우저 → Vercel (Next.js)
              │  next.config.ts 의 rewrites
              │  /api/:path*  →  ${API_ORIGIN}/api/:path*
              ▼
           Render (Spring Boot)  →  Neon (PostgreSQL)
```

- **프록시는 서버에서만 이뤄진다.** `API_ORIGIN`에 `NEXT_PUBLIC_`을 붙이지 않는다 —
  붙이면 클라이언트 번들에 백엔드 주소가 박힌다 (`NFR-SEC-22`)
- `NEXT_PUBLIC_USE_MOCK=1`이면 백엔드를 호출하지 않는다. **실연동은 `0`으로 바꿀 때**
- Render 주소를 브라우저로 직접 열면 `/`는 **401**이다. API 서버라 화면이 없다 —
  정상이다

### [9] 상시 가동 — ⏸️ **개발 단계에는 꺼둔다**

Render Free는 **15분 유휴 시 슬립**하고 깨어날 때 30~60초 걸린다.

> ⏸️ **2026-08-27 현재 핑은 꺼져 있다.** 접속하는 사람이 PM·BE뿐이라, 월 558시간을
> "아무도 안 쓰는데 깨어 있는 상태"로 쓸 이유가 없다. **FE·BE를 실제로 연결하는
> 시점(`NEXT_PUBLIC_USE_MOCK=0`)에 다시 켠다**
> ([`COST_GUARDRAILS.md §3.5`](COST_GUARDRAILS.md)).
>
> ⚠️ 그동안 **API 응답이 갑자기 느려 보이면 서버가 죽은 게 아니라 깨어나는 중**이다.

| 항목 | 값 |
|---|---|
| URL | `https://light-homepage.onrender.com/actuator/health/alive` |
| 스케줄 | `*/10 6-23 * * *` (10분마다, 06:00~23:59) |
| Timezone | **`Asia/Seoul`** |

**왜 24시간이 아닌가** — 750시간/월 한도에서 24시간 가동은 744시간(99.2%)이고,
배포 시 인스턴스가 겹쳐 도는 시간이 여기 쌓인다. 넘기면 과금이 아니라 **정지**다.
즉 "상시"를 노린 설정이 월말에 서버를 멈추게 한다
([`COST_GUARDRAILS.md §3.3`](COST_GUARDRAILS.md)).

**핑 경로는 반드시 `/actuator/health/alive`다.** `/actuator/health`는 DB까지
확인하므로, 10분마다 때리면 Neon이 한 번도 자동 정지되지 않는다 (§3.2).

---

## 3. 어디서 막혔는지 찾는 법

| 증상 | 보는 곳 | 흔한 원인 |
|---|---|---|
| CI가 아예 안 돌았다 | Actions 탭 | 경로 필터 — 바뀐 파일이 `frontend/**`·`backend/**` 밖 |
| CI 빌드 실패 | Actions 로그 | 로컬에서 §2 명령을 돌려 재현 |
| PR에 체크가 없다 | PR Checks | Jenkins는 5분 폴링. Actions는 경로 필터 |
| `deploy` 잡이 `skipping` | Actions | 정상 — PR이거나 `develop`이 아니거나 `backend/` 변경 없음 |
| 배포는 성공인데 서버가 응답 없음 | **Render Events → Logs** | ★ 아래 §4 참고 |
| Render 빌드 실패 | Render Logs | [`../infra/render/README.md §2.5`](../infra/render/README.md) 진단표 8줄 |
| 기동 실패 | Render Logs | `DATABASE_URL`에 `jdbc:` 누락 · 환경변수 미등록 |
| 첫 요청이 30~60초 | — | 슬립. 핑이 돌고 있는지 확인 |
| FE에서 API 호출 실패 | Vercel 환경변수 | `API_ORIGIN` 값 · `NEXT_PUBLIC_USE_MOCK` |

---

## 4. 이 흐름이 **보장하지 않는** 것

여기 적힌 것들은 전부 실제로 겪었거나 확인된 성질이다. 초록불을 믿으면 안 되는
지점들이다.

**① `deploy` 잡의 초록불은 배포 성공이 아니다**
훅을 호출하는 것까지만 한다. Render가 그 뒤에 빌드하다 실패해도 Actions는
`success`다. 2026-08-27에 훅이 두 번 성공했지만 **서버는 한 번도 뜨지 않았다.**

**② 서비스가 `Suspended`여도 훅은 200을 반환한다**
정지된 서비스는 `x-render-routing: suspend-by-user`와 함께 503을 준다. 그런데
배포는 "성공"으로 기록된다.
→ **배포 확인은 훅 결과가 아니라 실제 응답으로 한다.**

**③ Jenkins는 PM PC가 꺼지면 돌지 않는다**
그래서 배포 트리거를 Actions로 옮겼고, **2026-08-27에 시크릿 스캔도 옮겼다** —
그날 하루 Jenkins가 한 번도 돌지 않아 **시크릿 감지가 통째로 비어 있었다.**
남은 Jenkins 역할(변경 경로 감지·병렬 검증·Quality Gate)은 없어도 배포가 막히지
않는 것들이다.

**④ CI가 통과했다고 통합이 검증된 것은 아니다**
CI는 mock 빌드와 단위·인가 테스트까지다. `mock=0` 실왕복, 401→갱신→재시도,
R2 업로드는 **통합 시점에만 검증 가능**하다
([`handover/`](handover/)의 최신 문서 참고).

**⑤ 배포된 것이 곧 사용자에게 보이는 것은 아니다**
FE가 `NEXT_PUBLIC_USE_MOCK=1`이면 백엔드를 호출하지 않는다. 백엔드를 배포해도
화면은 mock 데이터를 보여준다.

---

## 5. 실측값 (2026-08-27)

추정이 아니라 실제로 측정한 값만 적는다.

| 항목 | 값 |
|---|---|
| 서비스 주소 | `https://light-homepage.onrender.com` |
| `/actuator/health/alive` | 200 `{"status":"UP"}` · 0.25초 (웜) |
| `/actuator/health` | 200 · `groups:["alive","liveness","readiness"]` — **DB까지 UP** |
| `/api/posts?category=NOTICE_PUBLIC` | 200 `{"items":[],...}` — 글 0건 |
| 첫 Docker 빌드 | 약 5분 (캐시 없음) |
| JVM 기동 | 8.6초 · 메모리 299MB / 상한 400MB · 이미지 442MB (2026-08-26 로컬) |
| Actions 사용 | 2026-08 기준 222회 / 약 236분 (한도 2,000분) |
| **슬립 방지 핑 동작** | ✅ **23분 무접촉 후 `200 / 0.246초`** — 임계 15분을 넘겼는데도 웜. ⏸️ 검증 후 개발 단계 동안 껐다 |

> ⚠️ **`category` 값은 `NOTICE`가 아니라 `NOTICE_PUBLIC`이다** (`PostCategory.java`).
> 틀리면 `400 VALIDATION_ERROR`가 오는데 서버 문제로 오해하기 쉽다.

---

## 관련 문서

| 문서 | 이 흐름의 어느 부분 |
|---|---|
| [`INTEGRATION.md`](INTEGRATION.md) | [1]·[5] 브랜치 소유·협업 규칙 |
| [`CICD.md`](CICD.md) | [3]·[4]·[6] CI 트리거·머지 게이트·CD 설계 |
| [`../infra/render/README.md`](../infra/render/README.md) | [7]·[9] Render 설정 절차·실패 진단 |
| [`BACKEND_DEPLOY.md`](BACKEND_DEPLOY.md) | [7] 백엔드 배포 규약 |
| [`COST_GUARDRAILS.md`](COST_GUARDRAILS.md) | [9] 무료 유지 장치·핑 스케줄 근거 |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | §8 호스팅 선택 근거 · §9 환경변수 |
| [`TESTING.md`](TESTING.md) | [2] 무엇을 어떻게 검증하는가 |
| [`DECISIONS.md`](DECISIONS.md) | 각 단계가 왜 이렇게 됐는지 |
