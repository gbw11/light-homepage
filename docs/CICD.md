# CI/CD 설계 — Jenkins

- 문서 버전: **v2.1** (2026-08-26 — CD를 GitHub Actions로 이관 · 배포 브랜치 `develop`)
- 담당: `server_develop` (서버 배포·인프라)
- 관련: [`INTEGRATION.md`](INTEGRATION.md) §6 브랜치 전략 · §10 CI

> **v2.0 변경**: 로컬 pre-push 훅을 폐기했습니다.
> **"push → CI 검증 → 통과하면 머지"** 흐름으로 단순화합니다. 근거는 §1.

---

## 1. 전략 — 왜 push를 막지 않는가

애초의 요구는 **"테스트에 실패하면 git에 올라가지 않게"** 였습니다. 이건 기술적으로 CI가 할 수 없습니다.

```
로컬 커밋 → git push → GitHub에 이미 올라감 → CI 실행 → 테스트
                        ↑
                        이 시점에 "업로드"는 이미 끝났다
```

push 자체를 막는 유일한 수단은 로컬 pre-push 훅이지만, 다음 이유로 채택하지 않습니다.

| 문제 | 내용 |
|---|---|
| 강제력이 없다 | `--no-verify` 한 줄로 우회된다. "막았다"는 착각만 남는다 |
| 설치가 사람 손에 달렸다 | clone 직후 `git config core.hooksPath`를 각자 실행해야 한다. 한 명이 잊으면 무의미 |
| 개발 속도를 깎는다 | push마다 테스트를 기다린다. 느려지면 결국 `--no-verify`가 습관이 된다 |
| 검증이 두 곳으로 갈린다 | 훅과 CI의 테스트 범위가 달라져 "로컬은 통과, CI는 실패"가 반복된다 |

### 1.1 대신 채택하는 것 — 작업 브랜치에서 검증하고 머지로 통제

**보호할 대상은 push가 아니라 `*_develop`·`develop`·`main`의 상태입니다.**
`feat/*` 브랜치는 깨진 커밋이 올라가도 아무 피해가 없습니다 — 그게 작업 브랜치의 용도입니다.

```
feat/* 브랜치에서 작업
  ↓ push  (자유롭게, 몇 번이든)
CI 실행 (Jenkins + GitHub Actions)
  ↓
✅ 통과  →  PR 생성 → 머지  →  *_develop
❌ 실패  →  같은 브랜치에서 수정 후 다시 push  (머지하지 않는다)
```

**규칙 하나로 요약됩니다: CI가 ❌면 머지하지 않는다.**

### 1.2 그래서 실제 보호 구조는 2층

```
┌─ 1층: CI (Jenkins + GitHub Actions) ────── 여기가 진실
│   · 모든 브랜치 push마다 빌드 + 테스트 + 인가 매트릭스
│   · GitHub 커밋 상태(✅/❌) 갱신
└─ 서버

┌─ 2층: 머지 게이트 ──────────────────────── 여기서 통합을 막는다
│   · CI 실패 시 머지 금지 (규칙 — §4)
│   · *_develop 이상은 PR 경유 (규칙 — INTEGRATION.md §6)
└─ PR
```

깨진 코드가 `feat/*`에 있는 것은 허용하고, **통합 브랜치로 넘어가는 것만 막습니다.**

### 1.3 시크릿은 어떻게 막는가

pre-push 훅의 스캔 기능이 없어지므로 다음으로 대체합니다.

| 수단 | 시점 | 비고 |
|---|---|---|
| `.gitignore` (`.env`, `application-local.yml`) | 커밋 전 | 1차 방어. 실수의 대부분을 여기서 막는다 |
| **CI의 시크릿 스캔 스테이지** (§3.6) | push 후 | ❌ 표시 → 머지 차단 |
| GitHub Push Protection *(Public 전환 시)* | push 시 | 무료 Private에서는 사용 불가 |
| 코드 리뷰 | PR | 최종 |

> ⚠️ **시크릿이 push된 뒤 CI가 잡아내면 이미 늦습니다.** 히스토리에서 지우기 어려우므로
> **해당 키를 폐기·재발급하는 것이 유일한 복구**입니다. `.gitignore`와 습관이 실질적 방어선입니다.

---

## 2. 개발자 워크플로 (clone 직후 설정 없음)

훅 설치 절차가 사라졌습니다. clone하면 바로 작업합니다.

```bash
git clone https://github.com/gbw11/light-homepage.git
cd light-homepage

# 하위 작업 브랜치를 판다 (*_develop에서 직접 작업하지 않는다)
git checkout server_develop && git pull
git checkout -b feat/infra-jenkins

# ... 작업 ...
git push -u origin feat/infra-jenkins    # 실패해도 괜찮다. 작업 브랜치다
```

push 후 할 일:

1. Jenkins(또는 PR의 Actions 체크)에서 결과를 확인한다
2. ❌면 같은 브랜치에서 고쳐 다시 push한다
3. ✅면 PR을 올리고 머지한다

**로컬에서 미리 돌려보고 싶을 때** (선택, 강제 아님):

```bash
cd frontend && npm run lint && npx tsc --noEmit
cd backend  && ./gradlew test --tests '*AuthorizationMatrix*'
```

---

## 3. 1층 — Jenkins

### 3.1 왜 Jenkins인가 (그리고 비용 문제)

GitHub Actions가 이미 설정돼 있고 무료·운영 부담 0입니다. Jenkins를 쓰는 이유는 **CI/CD 학습**과 **배포 자동화 제어**입니다 (Spring Boot를 택한 이유와 같은 맥락).

⚠️ 단 **Jenkins는 상시 실행 서버가 필요합니다.** 이 프로젝트의 $0 제약과 충돌하므로 호스팅을 신중히 골라야 합니다.

| 옵션 | 비용 | 특징 | 판단 |
|---|---|---|---|
| **로컬 Docker** (개발 PC) | $0 | PC가 꺼지면 정지. webhook 불가 → **SCM 폴링** | ★ 학습·초기 |
| **Oracle Cloud Always Free** (ARM VM) | **$0 영구** | 4 OCPU / 24GB. 상시 가동·webhook 가능 | ★ 정식 운영 |
| Render / Railway | 유료 | 영구 디스크 필요 → 무료 티어 부적합 | ✕ |
| GitHub Actions | $0 | 운영 부담 0. 단 학습 목적 미달 | 병행 유지 |

**권장 경로: 로컬 Docker로 시작 → 익숙해지면 Oracle Cloud Always Free로 이전**

### 3.2 GitHub Actions와의 역할 분담

둘 다 유지하되 **역할을 명확히 나눕니다.** 같은 일을 두 곳에서 하면 유지보수가 두 배가 됩니다.

| | GitHub Actions | Jenkins |
|---|---|---|
| 역할 | **검증 + CD(배포)** | **CI 상세 검증** (배포는 하지 않음) |
| 장점 | 운영 부담 0, **PC 꺼져도 동작** | 학습, 파이프라인 시각화, 변경 경로 감지 |
| 트리거 | push · PR | push (5분 폴링) |

> ### ⚠️ 2026-08-26 변경 — CD가 Jenkins에서 Actions로 넘어갔습니다
>
> 원래 설계는 Jenkins가 CD를 맡는 것이었습니다(학습 목적). 그런데 **Jenkins는 PM
> 로컬 PC에 있습니다.** PC가 꺼져 있으면 머지해도 배포가 일어나지 않고, 나중에
> PC를 켜야 반영됩니다. **자동 배포가 사람의 PC 상태에 달려 있으면 그건 자동이
> 아닙니다.**
>
> 그래서 배포 트리거만 Actions로 옮겼습니다. Jenkins는 **CI 검증과 파이프라인
> 학습**이라는 원래 가치를 그대로 유지합니다 — 변경 경로 감지·시크릿 스캔·
> 병렬 검증은 Actions에 없는 것들입니다.
>
> **Jenkins를 상시 가동 서버(Oracle Cloud, §3.1)로 옮기면 CD를 되가져올 수 있습니다.**
> 그때는 이 결정을 다시 봐야 합니다.

> **Jenkins가 로컬 PC에 있는 동안은 Actions를 반드시 남겨둡니다** — PC가 꺼진 상태로 작업하는
> 상대방에게 검증 수단이 없어지고, 그러면 머지 게이트(§4)가 무너집니다.

### 3.3 Jenkins 설치 (로컬 Docker)

```bash
cd infra/jenkins
docker compose up -d
# → http://localhost:8090   (8080은 Spring Boot가 사용)
# 초기 비밀번호:
docker exec light-jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

**필수 플러그인**

| 플러그인 | 용도 |
|---|---|
| Git · GitHub · GitHub Branch Source | 저장소 연동 · 커밋 상태 보고 |
| Pipeline · Multibranch Scan Webhook Trigger | 파이프라인 · 브랜치 자동 감지 |
| Docker Pipeline | 테스트용 Postgres 컨테이너 |
| NodeJS | 프론트엔드 빌드 |
| Credentials Binding | 시크릿 주입 |
| Blue Ocean *(선택)* | 파이프라인 시각화 |

### 3.4 Credentials 등록 (Jenkins 관리 → Credentials)

| ID | 종류 | 용도 |
|---|---|---|
| `github-pat` | **Username with password** | 저장소 clone + 커밋 상태 보고 (Username: GitHub 아이디, Password: PAT) |
| `db-test-password` | Secret text | 테스트용 Postgres 비밀번호 |

⚠️ ~~`render-deploy-hook`~~은 **더 이상 Jenkins에 등록하지 않습니다** (2026-08-26).
배포 훅은 GitHub 저장소 시크릿 `RENDER_DEPLOY_HOOK`으로 옮겼습니다 (§5.2).

⚠️ **시크릿을 Jenkinsfile에 하드코딩하지 않습니다.** `credentials()`로만 참조합니다.

### 3.5 Multibranch Pipeline 생성

```
새 항목 → Multibranch Pipeline → 이름: light-homepage
  Branch Sources: GitHub
    Credentials: github-pat
    Repository: gbw11/light-homepage
    Behaviours: Discover branches (all) + Discover pull requests
  Build Configuration: by Jenkinsfile (경로: Jenkinsfile)
  Scan Repository Triggers:
    · 로컬 Jenkins  → Periodically: 5분  (SCM 폴링)
    · 공개 서버      → GitHub webhook
```

**5개 영구 브랜치 + `feat/*` 브랜치가 자동으로 감지되어 각각 파이프라인이 생성됩니다.**
`feat/*`에서도 CI가 돌아야 **머지 전에** 결과를 알 수 있습니다. 이것이 §1.1 흐름의 전제입니다.

> ### 무료 분을 아끼는 장치 2개
>
> ⚠️ **Private 저장소라 Actions 실행 시간이 무료 분(2,000분/월)에서 차감됩니다.**
> Public 저장소와 다릅니다.
>
> | 장치 | 효과 |
> |---|---|
> | `paths` 필터 | `frontend/**` 변경은 Backend CI를 돌리지 않습니다(그 반대도) |
> | `concurrency` 취소 | 같은 브랜치·PR에 새 커밋이 오면 앞의 실행을 취소합니다 |
>
> `concurrency`에서 **`develop`은 취소하지 않습니다** — `deploy` 잡이 Render 훅을
> 호출하는 중에 끊기면 배포가 트리거됐는지 알 수 없는 상태가 됩니다.
>
> 사용량과 경고선은 [`COST_GUARDRAILS.md §3.1`](COST_GUARDRAILS.md)에 있습니다.

### 3.6 파이프라인 단계

```
Checkout
  ↓
Detect Changes          변경 경로 감지 (frontend/ backend/)
  ↓
Secret Scan             시크릿 패턴 검사 (allowlist-secret 주석은 예외)
  ↓
┌────────────────┬────────────────┐
│ Frontend       │ Backend        │   (병렬)
│ · npm ci       │ · Postgres 기동 │
│ · lint         │ · compile      │
│ · tsc --noEmit │ · ★ 인가 매트릭스│
│ · build        │ · 전체 테스트   │
└────────────────┴────────────────┘
  ↓
Quality Gate            하나라도 실패하면 여기서 중단
  ↓
Report to GitHub        커밋에 ✅/❌ 표시   ← 머지 게이트의 근거
```

⚠️ **Jenkins에는 Deploy 스테이지가 없습니다** (2026-08-26 제거). 배포는
GitHub Actions가 합니다 — §3.2와 §5를 보세요. 두 곳에서 트리거하면 같은 커밋이
두 번 배포됩니다.

CI용 더미 시크릿은 해당 줄에 `allowlist-secret` 주석을 붙여 예외 처리합니다.
⚠️ 실제 시크릿에는 붙이지 않습니다 — "공개돼도 무해하다"를 명시적으로 선언하는 용도입니다.

### 3.7 브랜치별 동작

| 브랜치 | 테스트 | 배포 |
|---|---|---|
| `feat/*` | ✅ 전체 | ✕ |
| `frontend_develop` `backend_develop` `server_develop` | ✅ 전체 | ✕ |
| **`develop`** | ✅ 전체 | **✅ 백엔드 배포 (Render)** |
| `main` | ✅ 전체 | ✕ (공개 시점에 여기로 옮긴다) |

⚠️ **배포 대상은 `backend/`가 바뀐 머지뿐입니다.** 프론트 전용 머지는 백엔드를
재배포하지 않습니다. 프론트는 Vercel이 GitHub 연동으로 따로 배포합니다.

⚠️ **스테이징을 따로 둘 수 없습니다.** Render Free 750시간/월은 **서비스 하나를
24시간** 돌리는 양입니다. 두 개면 1500시간이라 한도를 넘어 과금됩니다
(`ARCHITECTURE.md §8.1`). 그래서 배포 대상은 언제나 하나입니다.

---

## 4. 2층 — 머지 게이트

### 4.1 이상적인 방법 (현재 불가)

GitHub 브랜치 보호에서 **CI 상태 체크를 필수(required status check)로 지정**하면, 테스트 실패 시 머지 버튼이 잠깁니다.

⚠️ **무료 Private 저장소에서는 브랜치 보호를 쓸 수 없습니다** (GitHub Pro 필요, `INTEGRATION.md §6.11`).

### 4.2 현실적인 대안

| 방법 | 효과 |
|---|---|
| **CI 커밋 상태 표시** | PR에 ✅/❌가 보임 → 눈으로 확인 후 머지 (**규칙**) |
| **PR 템플릿의 CI 확인 체크박스** | 머지 직전에 강제로 눈에 들어오게 함 |
| 저장소를 Public으로 전환 | 브랜치 보호 무료 사용 가능. **단 문서에 내부 정보 있어 비권장** |
| GitHub Pro ($4/월) | 완전한 강제. **$0 제약과 충돌** |

**규칙으로 정합니다.**

1. **PR에 ❌가 있으면 머지하지 않습니다.** 상태가 안 보이면 Jenkins를 먼저 확인합니다
2. **`*_develop`·`develop`·`main`에 직접 push하지 않습니다.** 반드시 `feat/*` → PR을 경유합니다
3. **`main`으로 가는 것은 마일스톤 시점의 `develop` 머지뿐입니다**

기술적 강제가 없으므로 이 3개는 **팀 약속**입니다. 실수로 통합 브랜치에 push했다면
즉시 상대에게 알리고 되돌리기를 협의합니다 (`INTEGRATION.md §6.11`).

---

## 5. CD — 배포 자동화

### 5.0 ⚠️ 첫 공개 배포 전 필수 확인

| # | 항목 | 왜 |
|---|---|---|
| 1 | **`frontend/public/photos/`·`public/bulletins/` mock 자산을 운영 번들에서 제외** | `public/`은 **인증 없이 정적 서빙**된다. 얼굴이 식별되는 실제 인물 사진 47장이 `/photos/retreat-2026/...`로 누구나 접근 가능해진다. `robots.txt`·`X-Robots-Tag`는 색인만 막고 직접 접근은 막지 못한다. 실서비스는 R2 presigned URL을 쓰므로 이 자산이 운영에 필요하지 않다 — `docs/DECISIONS.md` 2026-08-24 항목의 3가지 해결안 중 택일 |
| 2 | **Vercel에 `API_ORIGIN` 환경변수 설정** | 없으면 서버 렌더링 시 백엔드 호출이 실패해 공개 공지가 초기 HTML에 안 들어간다 → 검색 유입 손실 (M1의 핵심 가치). ⚠️ `NEXT_PUBLIC_` 접두사를 붙이지 않는다 (NFR-SEC-22) |
| 3 | **`NEXT_PUBLIC_USE_MOCK=0` 확인** | mock으로 배포되면 가짜 데이터가 그대로 공개된다 |
| 4 | **`NEXT_PUBLIC_SITE_URL`을 실제 도메인으로** | OG 태그·sitemap의 절대 URL이 localhost로 나간다 |

> 1번은 **개인정보 문제**라 다른 항목보다 우선순위가 높다. 배포 후에 발견하면
> 이미 크롤링·캐싱됐을 수 있다.

### 5.1 배포 대상

| 대상 | 트리거 | 방식 |
|---|---|---|
| 프론트엔드 (Vercel) | `main` push | **Vercel의 GitHub 연동이 자동 처리** — CI 개입 불필요 |
| 백엔드 (Render) | **`develop` push + `backend/` 변경 + 테스트 통과** | **GitHub Actions**가 Deploy Hook 호출 |
| DB 마이그레이션 | 백엔드 시작 시 | Flyway 자동 실행 |

```
feat/be-*  →  backend_develop  →  develop
                                     ↓
                          GitHub Actions (클라우드, 항상 동작)
                          ├─ Postgres 띄우고 build + test
                          │   (★ 인가 매트릭스 포함)
                          └─ ✅ 통과 → Render Deploy Hook ──▶ 🚀
```

**왜 `main`이 아니라 `develop`인가** (PM 결정 2026-08-26)

아직 공개 사용자가 없고 백엔드가 막 개발을 시작했습니다. BE의 평소 흐름에서
바로 서버에 반영되는 편이 확인 주기가 짧습니다. `main`을 배포 대상으로 두면
배포할 때마다 `develop → main` PR을 하나 더 머지해야 하는데, 지금 단계에서는
그 의식이 값을 하지 못합니다.

**`main`은 "공개된 것"이라는 의미를 유지합니다.** 공개 시점에 배포 대상을
`main`으로 옮기며, 그때 **두 곳을 같이** 바꿔야 합니다:
1. Render 서비스의 Branch 설정
2. `.github/workflows/backend-ci.yml`의 `deploy` 잡 조건 (`refs/heads/develop` → `refs/heads/main`)

**구현**: `.github/workflows/backend-ci.yml`의 `deploy` 잡.
`build` 잡이 `skipped` 출력을 내보내고, deploy는 **검증을 실제로 한 빌드에서만**
동작합니다 — guard가 건너뛴 빌드는 초록불이어도 아무것도 검증하지 않은 것이라
그 상태로 배포하면 테스트 게이트가 없는 배포가 됩니다.

### 5.2 Render Deploy Hook

Render 대시보드 → Settings → Deploy Hook에서 URL을 발급받아
**GitHub 저장소 시크릿 `RENDER_DEPLOY_HOOK`**으로 등록합니다
(Jenkins credential이 아닙니다 — 2026-08-26에 옮겨졌습니다).

```
저장소 Settings → Secrets and variables → Actions → New repository secret
  Name: RENDER_DEPLOY_HOOK
```

시크릿이 없으면 배포 잡이 **명시적으로 실패**합니다(조용히 넘어가지 않습니다).
훅 호출은 `curl -fsS`라 4xx/5xx도 실패로 잡힙니다 — `-f` 없이 쓰면 훅이 죽어도
초록불이 뜹니다.

⚠️ Render의 자동 배포(Auto-Deploy)는 **반드시 꺼두세요.** 켜두면 테스트를
기다리지 않고 push 즉시 배포됩니다. **테스트를 통과한 커밋만 배포되게 하려면
트리거가 하나여야 합니다.**

설정 절차 전체는 [`../infra/render/README.md`](../infra/render/README.md)에 있습니다.

### 5.3 배포 순서 (계약 변경 시)

```
비호환 API 변경:  백엔드 먼저 배포 → 확인 → 프론트엔드 배포
호환 추가:        순서 무관
```

백엔드는 `develop` 머지 시점에, 프론트는 `main` 머지 시점에 배포됩니다.
백엔드가 먼저 나가는 구조라 비호환 변경의 기본 순서와 맞습니다.

---

## 6. 테스트 전략 — 무엇을 반드시 통과해야 하는가

CI가 유일한 판정자이므로 **모든 검사는 CI에 있습니다.** 로컬 실행은 선택입니다.

### 6.1 백엔드 (필수)

| 테스트 | 중요도 | CI |
|---|---|---|
| **인가 매트릭스** (`ARCHITECTURE.md §5.3`) | **최상** | ✅ |
| 인증 (JWT 발급·만료·위조) | 높음 | ✅ |
| 서비스 단위 테스트 | 중간 | ✅ |
| Flyway 마이그레이션 재현 | 중간 | ✅ |

> **인가 매트릭스는 절대 건너뛰지 않습니다.** RLS가 없는 이 프로젝트에서 권한 회귀는
> 되돌릴 수 없는 사고이고, 사람의 기억으로 막을 수 없습니다.

### 6.2 프론트엔드

| 검사 | CI |
|---|---|
| ESLint | ✅ |
| 타입 체크 (`tsc --noEmit`) | ✅ |
| 빌드 | ✅ |
| 컴포넌트 테스트 | 도입 시 |

프론트엔드 단위 테스트는 현재 계획에 없습니다(시간 산정 미포함). 도입하려면 Vitest + Testing Library를 M4에 추가하고 시간을 재산정해야 합니다.

### 6.3 실패 시 대응

```
feat/* 실패           → 같은 브랜치에서 수정 후 다시 push. 머지하지 않는다
*_develop 이상 실패    → 즉시 수정 커밋 + 상대에게 알림 (통합 브랜치가 깨진 상태다)
main 실패             → 배포 중단됨. 롤백 여부 협의
```

---

## 7. 구축 순서 (권장)

`server_develop` 하위 `feat/infra-*` 브랜치에서 진행합니다.

| # | 작업 | 예상 | 시점 |
|---|---|---|---|
| 1 | Jenkins 로컬 Docker 기동 + 플러그인 | 3h | M1 |
| 2 | Multibranch Pipeline + `Jenkinsfile` 연결 | 4h | M1 |
| 3 | 백엔드 파이프라인 (Postgres 컨테이너 + 테스트) | 4h | M2 |
| 4 | 프론트엔드 파이프라인 | 2h | M2 |
| 5 | GitHub 커밋 상태 보고 | 2h | M2 |
| 6 | 시크릿 스캔 스테이지 | 1h | M2 |
| 7 | **CD — Render 배포 훅** | 3h | M3 |
| 8 | Oracle Cloud로 Jenkins 이전 *(선택)* | 8h | M4 |
| | **합계** | **19~27h** | |

⚠️ **이 시간은 기존 산정(FE 282h / BE 313h)에 포함되지 않았습니다.**
Jenkins 도입은 순증 작업이므로 전체 일정이 **약 1주 늘어납니다** (11~13주 → 12~14주).
학습 가치가 그만큼 있다고 판단되면 진행하시고, 아니면 GitHub Actions만으로도 CI는 충분합니다.

---

## 8. 파일 위치

```
Jenkinsfile                        파이프라인 정의 (루트)
infra/jenkins/
├─ docker-compose.yml              Jenkins 로컬 기동
└─ README.md                       플러그인·credentials 설정
.github/
├─ workflows/                      GitHub Actions (병행 유지)
└─ pull_request_template.md        PR 템플릿 (CI 확인 체크박스)
```

---

## 9. 요약

| 요구 | 실현 방법 | 완전성 |
|---|---|---|
| 커밋마다 테스트 | Jenkins Multibranch (모든 브랜치 자동 감지) | ✅ |
| 테스트 실패 시 업로드 차단 | **포기.** `feat/*`에는 깨진 커밋을 허용한다 (§1) | — |
| **테스트 실패 시 통합 차단** | **CI 상태 + 머지 규칙** | ⚠️ 무료 플랜은 기술적 강제 불가 |
| 배포 자동화 | **Actions → Render 훅** / Vercel 자동 | ✅ (Render 서비스 생성 후 동작) |
| 시크릿 유출 방지 | `.gitignore` + CI 스캔 + 리뷰 | ⚠️ 노출 시 키 재발급이 유일한 복구 |
| 통합 브랜치 직접 push 차단 | 팀 규칙 | ⚠️ 기술적 강제 없음 |

**핵심 문장 하나**: *깨진 코드가 작업 브랜치에 올라가는 것은 문제가 아니다. 그것이 `develop`으로 넘어가는 것이 문제다. 그래서 막는 지점은 push가 아니라 머지다.*
