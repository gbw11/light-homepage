# 개발 도구 버전 고정 — LIGHT 홈페이지

- 문서 버전: **v1.0** · 2026-08-21
- 대상: **프론트엔드 · 백엔드 · 인프라 전원 필독**
- 관련: [`INTEGRATION.md`](INTEGRATION.md)(협업 규칙) · [`CICD.md`](CICD.md)(파이프라인)

---

## 0. 왜 이 문서가 필요한가

FE와 BE는 **다른 언어·다른 프로세스·다른 배포**입니다. 서로의 코드를 볼 일이 거의 없는 대신, 접점이 **API 하나와 CI 하나**로 좁아졌습니다. 그 좁은 접점에서 버전이 어긋나면 증상이 이렇게 나타납니다.

| 증상 | 실제 원인 |
|---|---|
| "내 컴퓨터에서는 되는데 CI에서 깨진다" | 로컬 Node ≠ CI Node |
| "네 브랜치 머지하니까 빌드가 깨졌다" | 로컬에서만 되는 문법·API를 쓴 것 |
| "Flyway 마이그레이션이 CI에서만 실패한다" | 로컬 Postgres ≠ CI Postgres |
| "gradlew가 실행이 안 된다 (`bad interpreter`)" | 개행이 CRLF로 체크아웃됨 |

**원칙: 로컬 = GitHub Actions = Jenkins = 운영. 네 곳의 버전이 같아야 합니다.**
한 곳만 다르면 그 곳이 통과 여부를 결정하게 되고, CI를 믿을 수 없게 됩니다.

---

## 1. 한 장 요약 — 이 버전으로 맞춥니다

| 도구 | **고정 버전** | 누가 | 확인 |
|---|---|---|---|
| **Node.js** | **22.x LTS** | FE (BE는 불필요) | `node -v` → `v22.` |
| npm | Node 22 동봉 (10.x) | FE | `npm -v` |
| **Java (JDK)** | **21 · Temurin** | BE (FE는 불필요) | `java -version` → `21.` |
| Gradle | **Wrapper 사용** (`./gradlew`) | BE | 별도 설치 금지 |
| Spring Boot | **3.5.x** | BE | `build.gradle` |
| **PostgreSQL** | **16** | BE·CI·Neon | `postgres:16` |
| **Docker Desktop** | 최신 (Compose v2 포함) | BE·인프라 | `docker compose version` |
| Git | 2.4x 이상 | 전원 | `git --version` |
| Jenkins | `jenkins/jenkins:lts-jdk21` | 인프라 | `infra/jenkins/docker-compose.yml` |

> ⚠️ **Node를 BE가, Java를 FE가 설치할 필요는 없습니다.** 상대 프로젝트를 실행해야 하는 건 통합 시점(§7)뿐입니다.

---

## 2. ⚠️ 지금 어긋나 있는 것 — 3건 (조치 필요)

발견 시점 2026-08-21. **머지 게이트의 신뢰도에 직접 영향이 있으므로 우선 처리합니다.**

### ① Node 버전이 3곳에서 서로 다르다 ★

| 위치 | 발견 시점 | 근거 |
|---|---|---|
| FE 개발 PC | **24.18.0** | `node -v` |
| GitHub Actions | **22** (`develop`에는 아직 20 — `frontend_develop`에 상향분이 있고 통합 #1에 들어옵니다) | `.github/workflows/frontend-ci.yml` |
| Jenkins | **node20** → ✅ **node22로 수정됨** (`feat/infra-node22`) | `Jenkinsfile` — `tools { nodejs 'node22' }` |

Next 16의 요구는 Node 20.9+ 이므로 셋 다 "동작은" 합니다. 문제는 **로컬에서 통과한 것이 Jenkins에서 깨져도 원인을 찾는 데 시간이 든다**는 점입니다. Node 24에만 있는 API를 무심코 쓰면 Jenkins에서만 실패합니다.

**조치 — 22 LTS로 통일**
- [ ] FE 개발 PC: Node **22 LTS** 설치 (`nvm-windows` 권장 → `nvm install 22 && nvm use 22`)
- [x] `Jenkinsfile`: `nodejs 'node20'` → `'node22'` · `infra/jenkins/README.md` 갱신
- [ ] **Jenkins UI**: Global Tool Configuration에 NodeJS 22를 **`node22`** 이름으로 등록
      ⚠️ 이걸 안 하면 파이프라인이 `Tool type "nodejs" does not have an install of "node22"` 로 실패합니다
- [ ] GitHub Actions: `frontend_develop`의 상향분(20 → 22)이 통합 #1에 `develop`으로 들어옴 → 그때 확인
- [ ] `frontend/package.json`에 `engines` 명시로 못 박기

```json
"engines": { "node": ">=22.0.0 <23" }
```

> 22를 고른 이유: Actions가 이미 22이고, Node 24는 LTS 승격이 더 늦어 CI 이미지 지원이 뒤따릅니다. **가장 적게 바꾸면서 가장 안정적인 선택**입니다.

### ② Docker가 FE 개발 PC에 없다

현재 `docker` 명령이 없습니다. FE 단독 개발에는 필요 없지만, **통합 시점(§7)에 백엔드를 띄우려면 로컬 Postgres가 필요**합니다.
- [ ] FE: 통합 #1(M1 말) 전까지 Docker Desktop 설치
- [ ] BE·인프라: 지금 당장 필요 (로컬 DB + Jenkins)

### ③ `backend/`에 Gradle 프로젝트가 아직 없다

`backend/README.md`만 있고 `gradlew`가 없습니다. 그래서 CI가 백엔드 검증을 **건너뛰고 있습니다**(`backend-ci.yml`의 guard 스텝). 즉 지금은 백엔드에 대해 **머지 게이트가 사실상 없는 상태**입니다.
- [ ] BE: W0 초기화 시 `backend/README.md`의 start.spring.io 설정 그대로 생성 → guard가 자동 해제됨

---

## 3. 프론트엔드 버전 고정

`frontend/package.json`이 기준입니다. **여기 적힌 것과 실제가 다르면 `package.json`이 맞습니다.**

| 항목 | 버전 | 비고 |
|---|---|---|
| Next.js | **16.3.1** | Turbopack 기본. `--no-turbopack` 플래그 없음 |
| React / React DOM | **19.2.8** | |
| TypeScript | 5.x | `strict` |
| Tailwind CSS | **v4** | ⚠️ 설정이 `tailwind.config.js`가 아니라 **CSS `@theme` 블록** |
| TanStack Query | 5.x | 회원 영역 |
| React Hook Form + Zod | 7.x / **4.x** | Zod 4는 3.x와 API가 다름 |
| 패키지 매니저 | **npm** (lockfileVersion 3) | ⚠️ yarn·pnpm 혼용 금지 |

**규칙**
- 설치는 항상 `npm ci` (CI와 동일하게). `npm install`은 lock 파일을 바꾸므로 의존성 추가 시에만
- `package-lock.json`은 **반드시 커밋**합니다
- 의존성을 추가하면 PR 본문에 이유를 한 줄 남깁니다 (번들 크기는 Lighthouse 90+ 목표에 직결)

⚠️ **Next 16은 학습 데이터와 다릅니다.** 코드 작성 전 `frontend/AGENTS.md`의 지시대로 `node_modules/next/dist/docs/`의 해당 가이드를 확인하세요.

---

## 4. 백엔드 버전 고정

`backend/build.gradle`이 기준입니다.

| 항목 | 버전 | 왜 이 버전인가 |
|---|---|---|
| Java | **21 (LTS)** | Actions·Jenkins·Render 전부 21. **17이나 23으로 만들지 마세요** |
| JDK 배포판 | **Temurin** | CI(`distribution: temurin`)와 동일 |
| Spring Boot | **3.5.x** | Spring Security 6 · Java 21 조합 |
| Gradle | **Wrapper** (`./gradlew`) | 로컬에 Gradle을 따로 깔지 않습니다. 버전이 저장소에 고정됨 |
| jjwt | **0.12.6** | 0.11 → 0.12에서 API가 크게 바뀜. 예제 복붙 시 주의 |
| springdoc-openapi | **2.8.13** | Boot 3.5(Spring 6.2)용. 1.x는 Boot 2 전용. ⚠️ **2.6.0은 Spring 6.2에서 깨진다** — `ControllerAdviceBean(Object)` 생성자가 사라져 컨트롤러가 하나라도 있으면 `/v3/api-docs`가 500 |
| AWS SDK for Java | **BOM 2.28.0** | R2(S3 호환). v1 SDK 아님 |
| Apache PDFBox | **3.0.3** | 월례회 변환. 2.x와 API 다름 |
| PostgreSQL 드라이버 | Boot 관리 버전 | 직접 고정하지 않음 |
| 테스트 | JUnit 5 + MockMvc | `spring-security-test` 필수 |

**규칙**
- `gradle/wrapper/`, `gradlew`, `gradlew.bat`을 **반드시 커밋**합니다 (없으면 CI가 돌지 않습니다)
- `gradlew`는 **LF 개행**이어야 합니다 — `.gitattributes`가 강제하고 있으니 건드리지 마세요
- 의존성 버전을 올릴 때는 §8 절차를 따릅니다

---

## 5. 공용 인프라 버전

### 5.1 PostgreSQL — 16으로 통일

| 위치 | 설정 |
|---|---|
| 로컬 (BE) | `docker run ... postgres:16` |
| GitHub Actions | `image: postgres:16` |
| Jenkins | `docker.image('postgres:16')` |
| **운영 (Neon)** | ⚠️ **프로젝트 생성 시 16 선택** — 기본값이 상위 버전일 수 있습니다 |

로컬 실행:
```bash
docker run -d --name light-db -p 5432:5432 \
  -e POSTGRES_PASSWORD=local -e POSTGRES_DB=light postgres:16
```

> 마이너 버전 차이는 대체로 문제없지만, **메이저가 다르면 Flyway 마이그레이션이 로컬에서만 통과**하는 상황이 생깁니다.

### 5.2 Jenkins
- 이미지 **`jenkins/jenkins:lts-jdk21`** · 포트 **8090** (8080은 Spring Boot가 사용)
- 기동: `cd infra/jenkins && docker compose up -d`
- Global Tool Configuration에 **NodeJS 22**를 `node22`라는 이름으로 등록 (§2①)

### 5.3 Git
- 2.4x 이상. **개행은 `.gitattributes`가 관리**하므로 `core.autocrlf`를 임의로 바꾸지 마세요
- `gh` CLI는 선택 (PR 편의용)

---

## 6. 포트 배분 — 겹치면 연결이 안 됩니다

| 서비스 | 포트 | 비고 |
|---|---|---|
| Next.js | **3000** | `npm run dev` |
| **Spring Boot** | **8080** | ★ FE의 `API_ORIGIN`이 이 포트를 가리킴 |
| PostgreSQL | **5432** | Docker |
| Jenkins | **8090** | 8080 충돌 회피 |
| Swagger UI | 8080 하위 | `/swagger-ui.html` |

⚠️ **BE는 서버 포트를 8080에서 바꾸지 마세요.** 바꾸면 FE의 `.env.local`·`next.config.ts` 프록시가 전부 어긋납니다. 부득이하면 §8 절차로 공지합니다.

---

## 7. 연결 규약 — 버전만큼 중요한 것

프로그램 버전을 맞춰도 아래가 어긋나면 연결되지 않습니다.

| 항목 | 값 | 지키는 쪽 |
|---|---|---|
| API 경로 | 전부 **`/api/**`** 로 시작 | BE |
| 연결 방식 | Next.js `rewrites` 프록시 → **동일 출처** → **CORS 설정 불필요** | FE·BE |
| `API_ORIGIN` | `http://localhost:8080` (로컬) / Render URL (운영) | FE |
| ⚠️ 접두사 | `API_ORIGIN`에 **`NEXT_PUBLIC_`을 붙이지 않는다** | FE |
| 인증 | JWT **httpOnly 쿠키** (`Secure; SameSite=Lax`). localStorage 금지 | BE |
| 응답 형태 | `{ "data": ... }` / `{ "error": { code, message, field } }` | BE |
| 에러 코드 | 7개 집합만: `UNAUTHORIZED · FORBIDDEN · NOT_FOUND · VALIDATION_ERROR · PENDING_APPROVAL · STORAGE_LIMIT · DUPLICATE` | BE |
| ID 직렬화 | **문자열** (`"123"`) — JS Number 정밀도 | BE |
| 날짜 | ISO-8601 · 시각은 UTC + `Z` | BE |
| 계약서 | [`SPEC_API.md`](SPEC_API.md) + Swagger UI | 공동 |

**양쪽 동시 실행 (통합 시점)**
```bash
# 터미널 1
cd backend && ./gradlew bootRun     # → localhost:8080

# 터미널 2
cd frontend && npm run dev          # → localhost:3000
```
`frontend/.env.local`에서 `NEXT_PUBLIC_USE_MOCK=0`으로 바꾸면 실제 백엔드를 호출합니다. **BE 미구현 구간에서는 1로 두세요.**

---

## 8. 버전을 바꿔야 할 때 — 절차

혼자 올리면 상대 CI가 깨집니다. **버전 변경은 계약 변경과 동급으로 취급합니다.**

1. 주 2회 동기화에서 제안 (또는 급하면 즉시 공유)
2. 바꾸면 **아래 4곳을 같은 PR에서 함께** 고칩니다 — 하나라도 빠지면 CI가 갈라집니다
   - 로컬 개발 환경
   - `.github/workflows/*.yml`
   - `Jenkinsfile` (또는 Jenkins Global Tool)
   - 이 문서 §1 표
3. PR 제목에 `[TOOLCHAIN]` 접두사 → 상대가 자기 로컬도 올려야 함을 인지
4. 머지 후 상대가 로컬 버전을 맞췄는지 확인

**하지 말 것**
- 자기 로컬 버전만 올리고 CI는 그대로 두기
- 메이저 버전을 마일스톤 도중에 올리기 (M 경계에서만)
- `package-lock.json` / Gradle Wrapper를 커밋에서 빼기

---

## 9. 설치 확인 — 복사해서 실행

**PowerShell (Windows)**
```powershell
node -v            # v22.x  ← FE
npm -v             # 10.x
java -version      # 21.x Temurin  ← BE
git --version      # 2.4x+
docker compose version
```

**기대값과 다르면**
| 증상 | 조치 |
|---|---|
| `node`가 22가 아님 | nvm-windows로 `nvm install 22 && nvm use 22` |
| `java`가 없거나 17/23 | Temurin **21** 설치 후 `JAVA_HOME` 재설정 |
| `docker` 없음 | Docker Desktop 설치 (BE·인프라 필수) |
| `gradle` 명령을 찾음 | ❌ 설치 불필요 — 항상 `./gradlew` |

---

## 10. 요약 3줄

1. **Node 22 · Java 21 · Postgres 16** — 로컬·Actions·Jenkins·운영 네 곳 전부 같은 값
2. **8080은 Spring 고정** — 바꾸면 FE 프록시가 통째로 어긋난다
3. **버전 변경은 4곳을 같은 PR에서** — 하나라도 빠지면 CI를 믿을 수 없게 된다
