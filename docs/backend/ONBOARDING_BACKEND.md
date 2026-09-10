# 백엔드 온보딩 — 처음 왔을 때 읽는 순서

- 대상: **백엔드 담당자** (첫날)
- 소요: **읽기 약 2시간** + 환경 세팅 약 2시간 = **하루치(4h)**
- 이 문서는 "무엇을 읽을지"만 알려줍니다. 실제 작업 지시는 [`BACKEND_TASKS.md`](BACKEND_TASKS.md)에 있습니다.

> ### 📌 백엔드를 **그냥 띄워보려는** 프론트·인프라 담당이라면
> 이 문서 전체를 읽지 마세요. 아래 **[부록 — 백엔드 띄워보기](#부록--백엔드-띄워보기-프론트인프라-담당용)**
> 한 절만 보면 됩니다 (10분). 위 1~3단계는 백엔드 코드를 **쓰는** 사람을 위한 것이라,
> 프로젝트 생성·계정 발급처럼 지금 할 필요 없는 항목이 섞여 있습니다.

> 문서가 11개라 전부 읽으면 하루가 갑니다. **아래 순서대로 필요한 것만 읽으세요.**
> 순서에 이유가 있습니다 — 규칙 → 환경 → 작업 → 계약 순입니다.

---

## 1단계 — 반드시, 이 순서로 (약 80분)

| # | 파일 | 시간 | 왜 지금 읽는가 | 읽고 나면 알아야 할 것 |
|---|---|---|---|---|
| 1 | [`../README.md`](../../README.md) | 5분 | 프로젝트가 뭔지·저장소가 어떻게 생겼는지 | 3개 영역(공개·회원·운영), 브랜치 4단 구조 |
| 2 | [**`INTEGRATION.md`**](../ops/INTEGRATION.md) ★ | **25분** | **협업 규칙. 여기를 어기면 상대 작업이 막힙니다** | `*_develop`에서 직접 작업 금지 · 계약 변경 절차 · 소유권 |
| 3 | [**`TOOLCHAIN.md`**](../ops/TOOLCHAIN.md) ★ | 15분 | 설치할 것과 버전. **여기부터 손을 움직입니다** | Java 21 Temurin · Postgres 16 · 포트 8080 고정 |
| 4 | [**`../backend/README.md`**](../../backend/README.md) ★ | 15분 | 프로젝트 초기화 설정값 그대로 들어 있음 | start.spring.io 설정 · 의존성 · 무료 인프라 제약 |
| 5 | [**`BACKEND_TASKS.md`**](BACKEND_TASKS.md) ★ | **20분** | **당신의 작업 지시서. 이것만 읽어도 작업 가능하게 썼습니다** | 마일스톤별 체크리스트 · 인가 매트릭스 · 월례회 |

> ★ 표시 4개가 핵심입니다. 시간이 없으면 **2 → 4 → 5** 순으로 읽으세요.

---

## 2단계 — 코드 쓰기 직전에 (약 40분)

| # | 파일 | 시간 | 언제 필요한가 |
|---|---|---|---|
| 6 | [**`SPEC_API.md`**](../spec/SPEC_API.md) ★ | 25분 | **FE와의 계약서.** 엔드포인트 만들기 직전에 해당 절만 펴 보면 됩니다. 처음엔 §1(공통 규약)만 정독 |
| 7 | [`CICD.md`](../ops/CICD.md) | 15분 | 첫 push 전에. "왜 push는 막지 않고 머지를 막는가"가 핵심 |

---

## 3단계 — 필요할 때 펴 보는 참조 (지금 통독하지 마세요)

| 파일 | 언제 |
|---|---|
| [`ARCHITECTURE.md`](../spec/ARCHITECTURE.md) (48KB) | **§5 권한 · §7.7 월례회 · §9 환경변수 · §13 보안 체크리스트** 4개 절만 지금 보고, 나머지는 해당 기능 만들 때 |
| [`SPEC_FUNCTIONAL.md`](../spec/SPEC_FUNCTIONAL.md) | 기능 하나를 구현하기 직전, 그 기능의 수용 기준 확인용 |
| [`SPEC_NONFUNCTIONAL.md`](../spec/SPEC_NONFUNCTIONAL.md) | M4 보안·성능 마감 때 |
| [`PLAN.md`](../spec/PLAN.md) | "왜 이런 요구가 나왔는지" 배경이 궁금할 때 |
| [`WORKPLAN.md`](../spec/WORKPLAN.md) | 일정·시간 산정이 궁금할 때 (§1.5는 지금 볼 것 — M1에 여유 46h가 있고 그걸 어디 쓸지 적혀 있습니다) |
| [`WIREFRAME.md`](../spec/WIREFRAME.md) (58KB) | ❌ **읽지 않아도 됩니다.** FE가 무엇을 만드는지 궁금할 때만 |
| [`../infra/jenkins/README.md`](../../infra/jenkins/README.md) | Jenkins를 직접 띄울 때 |

---

## 읽고 나서 — 첫날 실행 체크리스트

```bash
git clone <저장소>
cd light-homepage
git checkout backend_develop
git checkout -b feat/be-init        # ★ backend_develop에서 직접 작업하지 않습니다
```

- [ ] JDK **21 Temurin** 설치 → `java -version` 확인
- [ ] Docker Desktop 설치 → 로컬 Postgres 16 기동
- [ ] [start.spring.io](https://start.spring.io)에서 `backend/README.md` 설정 그대로 생성
- [ ] `gradlew` · `gradle/wrapper/` 커밋 (없으면 CI가 백엔드를 통째로 건너뜁니다)
- [ ] `./gradlew bootRun` → `localhost:8080` 확인
- [ ] Neon · Cloudflare R2 · Render 계정 생성 → **어떤 계정을 썼는지 문서로 남기기** (나중에 교회 명의 이관)
- [ ] `application-local.yml`이 `.gitignore`에 걸리는지 확인
- [ ] push → GitHub Actions 통과 확인 → PR

---

## 첫날에 꼭 기억할 3가지

**1. DB가 막아주지 않습니다.**
초기 설계는 Supabase + RLS였습니다. 그 구조에서는 `where`를 빠뜨려도 DB가 막아줬지만, Spring이 단일 계정으로 접속하는 지금은 **그 방어선이 없습니다.** 코드에서 권한 검사를 빠뜨리면 그대로 유출됩니다.
→ **인가 테스트 매트릭스**([`BACKEND_TASKS.md`](BACKEND_TASKS.md) §6)가 마지막 방어선이고, **기능 코드보다 우선순위가 높습니다.**

**2. 계약을 조용히 바꾸지 마세요.**
응답 형태·에러 코드·필드명을 바꾸면 FE 작업이 통째로 어긋납니다. 절차는 [`INTEGRATION.md`](../ops/INTEGRATION.md) §5, 비호환 변경은 `[CONTRACT]` PR + 상대 승인.

**3. 1시간 룰.**
혼자 1시간 넘게 막히면 프론트 담당자에게 공유하세요. 하루 4시간 예산에서 1시간은 25%입니다.

---

## 한 장 요약

```
README.md          →  뭐 하는 프로젝트인지
INTEGRATION.md ★   →  어떻게 협업하는지 (규칙)
TOOLCHAIN.md ★     →  뭘 설치하는지 (버전)
backend/README ★   →  어떻게 초기화하는지
BACKEND_TASKS ★    →  뭘 만드는지 (지시서)
SPEC_API.md ★      →  어떤 모양으로 주고받는지 (계약)
CICD.md            →  어떻게 머지하는지
─────────────────────────────────────────
ARCHITECTURE · SPEC_* · PLAN · WORKPLAN  →  필요할 때 찾아보기
WIREFRAME                                →  안 읽어도 됨
```

---

## 부록 — 백엔드 띄워보기 (프론트·인프라 담당용)

**목표: 내 컴퓨터에서 백엔드를 실행해 Swagger로 API를 두드려 본다.**
IntelliJ도, 백엔드 지식도 필요 없습니다. 크레덴셜도 받지 않습니다.

### 0. 준비 (한 번만)

| 필요한 것 | 왜 |
|---|---|
| **JDK 21 (Temurin)** | 백엔드 실행 |
| **Docker Desktop** | 로컬 Postgres |

> **Gradle은 설치하지 않습니다.** 저장소에 래퍼(`gradlew`)가 들어 있어 알아서
> 내려받습니다 (`TOOLCHAIN.md §1` — "Wrapper 사용, 별도 설치 금지").

저장소는 이미 clone돼 있을 겁니다. **`frontend/`와 `backend/`가 같은 저장소에
있습니다** — 새로 받을 것은 없고 폴더만 옮기면 됩니다.

### 1. DB 띄우기

```bash
docker run -d --name light-db -p 5432:5432 -e POSTGRES_PASSWORD=local -e POSTGRES_DB=light postgres:16
```

> 두 번째부터는 `docker start light-db` 로 충분합니다.
> ⚠️ Docker Desktop이 꺼져 있으면 `docker` 명령이 파이프 오류를 냅니다.

### 2. 설정 파일 만들기

```bash
cd backend/src/main/resources
cp application-local.yml.example application-local.yml
```

**그대로 두고 아무것도 채우지 않아도 됩니다.** 크레덴셜 칸은 비어 있는 게 정상입니다.

### 3. 실행

```bash
cd backend                       # 저장소 루트에서
./gradlew bootRun --args='--spring.profiles.active=local'
```

Windows PowerShell이면 `./gradlew` 대신 `.\gradlew.bat` 입니다.
VS Code 하단 터미널에서 그대로 쳐도 됩니다.

첫 실행은 Gradle 내려받기 때문에 몇 분 걸립니다.

### 4. 열어보기

**<http://localhost:8080/swagger-ui.html>**

로그인은 **시드 계정** 3개로 합니다 (비밀번호는 example 파일의 `app.seed.password`):

| 아이디 | 역할 | 볼 수 있는 것 |
|---|---|---|
| `pastor` | 전도사 | 전부 (회원 관리 포함) |
| `leader` | 임원 | 관리 기능 대부분 |
| `member` | 회원 | 회원 열람 범위 |

세 개로 각각 로그인해 보면 **인가가 어떻게 갈리는지** 바로 보입니다.
명단(`member_roster`) 행도 함께 생성되므로 출석부·가입 흐름도 동작합니다.

### 5. ⚠️ 크레덴셜이 없어서 안 되는 것

| 기능 | 크레덴셜 없을 때 |
|---|---|
| 게시판 · 첨부 | ✅ 정상 |
| 인증 · 가입 · 비밀번호 재설정 | ✅ 정상 (재설정 코드는 **서버 로그**에 찍힙니다) |
| 출석부 · 회원 관리 · 새가족 | ✅ 정상 |
| 설교 · 라이브 | ⚠️ **빈 목록**. 500이 아닙니다 (YouTube 키 없음) |
| 카카오 로그인 | ⚠️ `400 VALIDATION_ERROR`. 아이디/비밀번호 로그인은 정상 |
| 사진첩 업로드 · 주보 · 월례회 | ❌ `409 STORAGE_LIMIT`<br>"파일 저장소가 준비되지 않았습니다" (R2 키 없음) |

**이건 고장이 아닙니다.** 키 없이 띄운 결과이고, 위 ✅ 항목만으로도 계약
확인에는 대체로 충분합니다.

파일 기능까지 봐야 한다면 **인프라 담당에게 별도 버킷 + 별도 액세스 키**를
요청하세요. 다른 사람의 R2 키를 받아 쓰지 마세요 — 과금과 전체 파일 접근이
걸려 있습니다 (`INTEGRATION.md §6.3` — R2 설정은 인프라 영역입니다).

### 프론트를 붙여보려면

`frontend/.env.local`에서:

```
API_ORIGIN=http://localhost:8080
NEXT_PUBLIC_USE_MOCK=0
```

`USE_MOCK=1`이면 백엔드를 띄우지 않아도 mock으로 개발됩니다. **화면만
만지는 중이라면 백엔드를 띄울 필요가 없습니다.**
