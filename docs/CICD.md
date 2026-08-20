# CI/CD 설계 — Jenkins

- 문서 버전: v1.0
- 담당: `server_develop` (서버 배포·인프라)
- 관련: [`INTEGRATION.md`](INTEGRATION.md) §6 브랜치 전략 · §10 CI

---

## 1. 먼저 — 요구사항의 기술적 한계

요구: **"브랜치에 커밋할 때마다 테스트하고, 실패하면 git에 업로드되지 않게"**

### 1.1 Jenkins는 push를 막을 수 없다
순서가 물리적으로 정해져 있습니다.

```
로컬 커밋 → git push → GitHub에 이미 올라감 → webhook → Jenkins 실행 → 테스트
                        ↑
                        이 시점에 이미 "업로드"는 끝났다
```

Jenkins는 **push 이후에 실행**되므로, Jenkins가 실패를 알려줄 때는 이미 코드가 GitHub에 있습니다. CI 도구의 본질적 한계이고 GitHub Actions도 동일합니다.

### 1.2 실제로 push를 막는 것은 pre-push 훅뿐이다

| 수단 | 무엇을 막는가 | 우회 가능? |
|---|---|---|
| **pre-push 훅** (로컬) | **push 자체** ✅ | `--no-verify`로 가능 |
| Jenkins / GitHub Actions | 아무것도 못 막음 (사후 검증·알림) | — |
| GitHub 브랜치 보호 | **머지**를 막음 (push는 못 막음) | ⚠️ **무료 Private 저장소에서 사용 불가** |

### 1.3 그래서 3층으로 설계한다

```
┌─ 1층: pre-push 훅 (로컬) ──────────────── 여기서 실제로 막는다
│   · 보호 브랜치 직접 push 차단
│   · 시크릿 커밋 차단
│   · 빠른 테스트 실패 시 push 중단
└─ 개발자 PC

┌─ 2층: Jenkins (권위 있는 검증) ─────────── 여기가 진실
│   · 전체 빌드 + 테스트 + 인가 매트릭스
│   · GitHub 커밋 상태(✅/❌) 갱신
└─ 서버

┌─ 3층: 머지 게이트 ──────────────────────── 여기서 통합을 막는다
│   · Jenkins 실패 시 머지 금지 (규칙 — §6 참조)
└─ PR
```

**1층이 "업로드 차단" 요구를 만족하고, 2층이 최종 판정, 3층이 오염 방지입니다.**

> ⚠️ pre-push 훅은 `--no-verify`로 우회할 수 있습니다. **완벽한 강제는 불가능**하며,
> 목적은 "실수로 깨진 코드를 올리는 것"을 막는 것입니다. 고의 우회는 팀 규칙의 영역입니다.

---

## 2. 1층 — pre-push 훅 (실제 차단)

### 2.1 설치 (각자 1회, 필수)
훅은 `.git/hooks`에 있으면 저장소에 커밋되지 않으므로, `.githooks/`를 커밋하고 경로를 지정합니다.

```bash
# 저장소 루트에서 1회 실행
git config core.hooksPath .githooks
chmod +x .githooks/pre-push        # Windows Git Bash에서도 실행
```

⚠️ **clone 직후 반드시 실행해야 합니다.** 안 하면 훅이 동작하지 않습니다. → `README.md`에 명시

### 2.2 훅이 검사하는 3가지

| # | 검사 | 실패 시 |
|---|---|---|
| 1 | **보호 브랜치 직접 push 차단** (`main` `develop` `*_develop`) | push 중단 |
| 2 | **시크릿 포함 여부** (`JWT_SECRET`, `application-local.yml`, `.env`, R2 키 패턴) | push 중단 |
| 3 | **빠른 테스트** (변경된 영역만) | push 중단 |

**1번이 특히 중요합니다.** 무료 Private 저장소에서는 브랜치 보호를 걸 수 없어(`INTEGRATION.md §6.11`) `main`에 직접 push하는 것을 GitHub이 막아주지 못합니다. **pre-push 훅이 그 역할을 대신합니다.**

**2번**은 CI로는 늦습니다. 시크릿이 GitHub에 한 번 올라가면 히스토리에서 지우기 어렵고 키를 재발급해야 합니다. **push 전에 막는 것이 유일하게 의미 있는 시점**입니다.

### 2.3 빠른 테스트의 범위 — 속도가 생명
pre-push가 5분 걸리면 아무도 안 씁니다. **목표는 90초 이내**입니다.

| 영역 | pre-push (빠름) | Jenkins (전체) |
|---|---|---|
| 프론트엔드 | `lint` + `tsc --noEmit` | + `build` |
| 백엔드 | `test --tests '*AuthorizationMatrix*'` + 컴파일 | + 전체 테스트 + build |

- 백엔드 전체 테스트는 DB가 필요해 느립니다 → **인가 매트릭스만** 돌립니다
  (가장 중요한 테스트이고, RLS가 없는 이 프로젝트의 마지막 방어선이므로)
- 로컬 Postgres가 안 떠 있으면 **경고만 하고 통과**시킵니다 (Jenkins가 잡습니다)

### 2.4 우회가 필요할 때
```bash
git push --no-verify        # 훅 건너뛰기
```
정당한 경우: 훅 자체가 고장났을 때, WIP를 개인 브랜치에 백업할 때.
⚠️ **보호 브랜치에는 `--no-verify`로도 올리지 않습니다.** 이건 규칙입니다.

---

## 3. 2층 — Jenkins

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
| 역할 | **PR 검증** (항상 동작) | **CI 상세 + CD(배포)** |
| 장점 | 운영 부담 0, PC 꺼져도 동작 | 학습, 배포 제어, 파이프라인 시각화 |
| 트리거 | PR 생성·갱신 | push (폴링 또는 webhook) |

> Jenkins가 안정화되면 Actions를 제거해도 됩니다. 다만 **Jenkins가 로컬 PC에 있는 동안은 Actions를 남겨두는 편이 안전합니다** — PC가 꺼진 상태로 작업하는 상대방에게 검증 수단이 없어지기 때문입니다.

### 3.3 Jenkins 설치 (로컬 Docker)
```bash
cd infra/jenkins
docker compose up -d
# → http://localhost:8080
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
| `github-pat` | Secret text | 저장소 clone + 커밋 상태 보고 (`repo`, `status` 스코프) |
| `render-deploy-hook` | Secret text | Render 배포 트리거 URL |
| `db-test-password` | Secret text | 테스트용 Postgres 비밀번호 |

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

### 3.6 파이프라인 단계

```
Checkout
  ↓
Detect Changes          변경 경로 감지 (frontend/ backend/)
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
Report to GitHub        커밋에 ✅/❌ 표시
  ↓
Deploy                  main 브랜치일 때만
  · Render 배포 훅 호출
  · Vercel은 GitHub 연동으로 자동 배포
```

### 3.7 브랜치별 동작

| 브랜치 | 테스트 | 배포 |
|---|---|---|
| `feat/*` | ✅ 전체 | ✕ |
| `frontend_develop` `backend_develop` `server_develop` | ✅ 전체 | ✕ |
| `develop` | ✅ 전체 | ✕ (원하면 스테이징 추가) |
| **`main`** | ✅ 전체 | **✅ 운영 배포** |

---

## 4. 3층 — 머지 게이트

### 4.1 이상적인 방법 (현재 불가)
GitHub 브랜치 보호에서 **Jenkins 상태 체크를 필수(required status check)로 지정**하면, 테스트 실패 시 머지 버튼이 잠깁니다.

⚠️ **무료 Private 저장소에서는 브랜치 보호를 쓸 수 없습니다** (GitHub Pro 필요, `INTEGRATION.md §6.11`).

### 4.2 현실적인 대안
| 방법 | 효과 |
|---|---|
| **Jenkins 커밋 상태 표시** | PR에 ✅/❌가 보임 → 눈으로 확인 후 머지 (**규칙**) |
| **pre-push 훅의 보호 브랜치 차단** | `*_develop` 이상에 직접 push 불가 → PR 경유 강제 |
| 저장소를 Public으로 전환 | 브랜치 보호 무료 사용 가능. **단 문서에 내부 정보 있어 비권장** |
| GitHub Pro ($4/월) | 완전한 강제. **$0 제약과 충돌** |

**규칙으로 정합니다: PR에 ❌가 있으면 머지하지 않습니다.** 상태가 안 보이면 Jenkins를 먼저 확인합니다.

---

## 5. CD — 배포 자동화

### 5.1 배포 대상
| 대상 | 트리거 | 방식 |
|---|---|---|
| 프론트엔드 (Vercel) | `main` push | **Vercel의 GitHub 연동이 자동 처리** — Jenkins 개입 불필요 |
| 백엔드 (Render) | `main` push + 테스트 통과 | Jenkins가 **Deploy Hook URL 호출** |
| DB 마이그레이션 | 백엔드 시작 시 | Flyway 자동 실행 |

### 5.2 Render Deploy Hook
Render 대시보드 → Settings → Deploy Hook에서 URL을 발급받아 Jenkins credential(`render-deploy-hook`)로 등록합니다.

```groovy
// main 브랜치 + 테스트 통과 시에만
withCredentials([string(credentialsId: 'render-deploy-hook', variable: 'HOOK')]) {
  sh 'curl -fsS -X POST "$HOOK"'
}
```

⚠️ Render의 자동 배포(Auto-Deploy)는 **꺼두세요.** 켜두면 Jenkins 테스트를 기다리지 않고 push 즉시 배포됩니다. **테스트를 통과한 커밋만 배포되게 하려면 Jenkins가 유일한 트리거여야 합니다.**

### 5.3 배포 순서 (계약 변경 시)
```
비호환 API 변경:  백엔드 먼저 배포 → 확인 → 프론트엔드 배포
호환 추가:        순서 무관
```
Vercel이 자동 배포되므로, 비호환 변경 시에는 **프론트엔드 머지를 백엔드 배포 확인 이후로** 미룹니다.

---

## 6. 테스트 전략 — 무엇을 반드시 통과해야 하는가

### 6.1 백엔드 (필수)
| 테스트 | 중요도 | pre-push | Jenkins |
|---|---|---|---|
| **인가 매트릭스** (`ARCHITECTURE.md §5.3`) | **최상** | ✅ | ✅ |
| 인증 (JWT 발급·만료·위조) | 높음 | — | ✅ |
| 서비스 단위 테스트 | 중간 | — | ✅ |
| Flyway 마이그레이션 재현 | 중간 | — | ✅ |

> **인가 매트릭스는 pre-push에도 포함합니다.** RLS가 없는 이 프로젝트에서 권한 회귀는 되돌릴 수 없는 사고이고, 사람의 기억으로 막을 수 없습니다.

### 6.2 프론트엔드
| 검사 | pre-push | Jenkins |
|---|---|---|
| ESLint | ✅ | ✅ |
| 타입 체크 (`tsc --noEmit`) | ✅ | ✅ |
| 빌드 | — | ✅ |
| 컴포넌트 테스트 | — | 도입 시 |

프론트엔드 단위 테스트는 현재 계획에 없습니다(시간 산정 미포함). 도입하려면 Vitest + Testing Library를 M4에 추가하고 시간을 재산정해야 합니다.

### 6.3 실패 시 대응
```
pre-push 실패  → 로컬에서 고치고 다시 push
Jenkins 실패   → 즉시 수정 커밋. *_develop 이상이면 상대에게 알림
main 실패      → 배포 중단됨. 롤백 여부 협의
```

---

## 7. 구축 순서 (권장)

`server_develop` 하위 `feat/infra-*` 브랜치에서 진행합니다.

| # | 작업 | 예상 | 시점 |
|---|---|---|---|
| 1 | **pre-push 훅 도입 + 팀 설치** | 2h | **지금 (즉시 효과)** |
| 2 | Jenkins 로컬 Docker 기동 + 플러그인 | 3h | M1 |
| 3 | Multibranch Pipeline + `Jenkinsfile` 연결 | 4h | M1 |
| 4 | 백엔드 파이프라인 (Postgres 컨테이너 + 테스트) | 4h | M2 |
| 5 | 프론트엔드 파이프라인 | 2h | M2 |
| 6 | GitHub 커밋 상태 보고 | 2h | M2 |
| 7 | **CD — Render 배포 훅** | 3h | M3 |
| 8 | Oracle Cloud로 Jenkins 이전 *(선택)* | 8h | M4 |
| | **합계** | **20~28h** | |

⚠️ **이 시간은 기존 산정(FE 282h / BE 313h)에 포함되지 않았습니다.**
Jenkins 도입은 순증 작업이므로 전체 일정이 **약 1주 늘어납니다** (11~13주 → 12~14주).
학습 가치가 그만큼 있다고 판단되면 진행하시고, 아니면 GitHub Actions만으로도 CI는 충분합니다.

**1번은 지금 바로 하는 것을 권합니다.** Jenkins 없이도 독립적으로 효과가 있고, 2시간이면 됩니다.

---

## 8. 파일 위치

```
Jenkinsfile                        파이프라인 정의 (루트)
.githooks/
├─ pre-push                        ★ 실제 차단 로직
└─ README.md                       설치 안내
infra/jenkins/
├─ docker-compose.yml              Jenkins 로컬 기동
└─ README.md                       플러그인·credentials 설정
.github/workflows/                 GitHub Actions (병행 유지)
```

---

## 9. 요약

| 요구 | 실현 방법 | 완전성 |
|---|---|---|
| 커밋마다 테스트 | Jenkins Multibranch (모든 브랜치 자동 감지) | ✅ |
| **테스트 실패 시 업로드 차단** | **pre-push 훅** | ⚠️ `--no-verify` 우회 가능 |
| 테스트 실패 시 머지 차단 | 규칙 + PR 상태 표시 | ⚠️ 무료 플랜은 강제 불가 |
| 배포 자동화 | Jenkins → Render 훅 / Vercel 자동 | ✅ |
| 시크릿 유출 방지 | pre-push 훅 스캔 | ✅ (push 전이 유일한 시점) |
| 보호 브랜치 직접 push 차단 | pre-push 훅 | ⚠️ 우회 가능하나 실수는 막힘 |

**핵심 문장 하나**: *Jenkins는 "무엇이 깨졌는지" 알려주고, pre-push 훅은 "깨진 것을 올리지 못하게" 막습니다. 둘은 대체 관계가 아니라 보완 관계입니다.*
