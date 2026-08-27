# Render 배포 설정 — PM이 손으로 해야 하는 것

`backend/Dockerfile`과 배포 자동화(`.github/workflows/backend-ci.yml`의 `deploy` 잡)는
**코드로 이미 들어가 있습니다.** 남은 것은 대시보드에서 계정·서비스를 만드는 일뿐이고,
그건 사람이 로그인해서 해야 합니다.

담당: PM/인프라 (`server_develop`)
관련: [`../../docs/BACKEND_DEPLOY.md`](../../docs/BACKEND_DEPLOY.md)(백엔드 규약) ·
[`../../docs/CICD.md`](../../docs/CICD.md) §5(CD 설계) ·
[`../../docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) §8(호스팅 선택 근거) ·
[`../../docs/COST_GUARDRAILS.md`](../../docs/COST_GUARDRAILS.md)(★ 과금 방지 설계)

---

## 0. 완료되면 이렇게 동작합니다

```
BE가 feat/be-* 에서 작업
   ↓ PR 머지
backend_develop
   ↓ PR 머지
develop  ──▶ GitHub Actions
              ├─ Postgres 띄우고 build + test (인가 매트릭스 포함)
              └─ ✅ 통과 → Render Deploy Hook 호출 ──▶ 🚀 배포
```

**BE 담당자는 평소처럼 머지만 하면 됩니다.** 그 외 조작은 없습니다.

> ⚠️ 배포는 **`develop`에 `backend/` 변경이 들어올 때만** 일어납니다.
> 프론트 전용 머지는 백엔드를 재배포하지 않습니다(그럴 이유가 없습니다).

---

## 1. 순서대로 — 최초 1회

> ### ⚠️ ⓪ 먼저 — 어느 서비스에도 **카드를 등록하지 마세요**
>
> Neon·Render 모두 결제 수단 없이 무료 플랜을 쓸 수 있습니다. **결제 수단이
> 없으면 한도를 넘겨도 과금이 아니라 서비스 정지로 나타납니다** — 그게
> 이 프로젝트의 1차 방어입니다 (`../../docs/COST_GUARDRAILS.md §0`).
>
> 가입 과정에서 카드를 요구하는 화면이 나오면 **멈추고 확인하세요.** 무료
> 한도가 있어도 카드를 요구하는 서비스는 채택 대상이 아닙니다.

### ① Neon에서 DB부터 만듭니다 (Render보다 먼저)

Render 서비스에 넣을 `DATABASE_URL`이 여기서 나오므로 순서가 이렇습니다.

1. https://neon.tech 가입 → 프로젝트 생성
2. **리전은 `Asia Pacific (Singapore)`** — 한국에서 가장 가깝습니다
3. PostgreSQL 버전 **16** (`TOOLCHAIN.md §1`에서 고정한 값)
4. 연결 문자열을 받아둡니다

> ### ⚠️ 여기서 가장 많이 막힙니다 — 주소 형식을 바꿔야 합니다
>
> Neon이 주는 것은 **libpq 형식**입니다:
> ```
> postgres://light_owner:npg_xxxx@ep-cool-1234.ap-southeast-1.aws.neon.tech/light?sslmode=require
> ```
>
> 그런데 우리 `application.yml`은 **JDBC 형식**을 기대하고, 아이디·비밀번호는
> `DB_USERNAME`/`DB_PASSWORD`로 **따로** 받습니다. 그래서 이렇게 쪼갭니다:
>
> | 환경변수 | 값 |
> |---|---|
> | `DATABASE_URL` | `jdbc:postgresql://ep-cool-1234.ap-southeast-1.aws.neon.tech/light?sslmode=require` |
> | `DB_USERNAME` | `light_owner` |
> | `DB_PASSWORD` | `npg_xxxx` |
>
> **`jdbc:` 접두사를 빼먹거나 아이디·비밀번호를 URL에 남겨두면** 기동 시
> `Driver claims to not accept jdbcUrl` 또는 인증 실패로 죽습니다.
> `?sslmode=require`도 빼면 안 됩니다 — Neon은 SSL을 강제합니다.

### ② Render 서비스 생성

https://render.com → New → **Web Service** → 이 저장소 연결

| 항목 | 값 |
|---|---|
| Language / Runtime | **Docker** |
| Branch | **`develop`** ← ⚠️ main 아님 (`CICD.md §5.1`) |
| Root Directory | `backend` |
| Dockerfile Path | **`Dockerfile`** ← ⚠️ `backend/Dockerfile` 아님 (아래 참고) |
| Region | **Singapore** (Neon과 같은 리전에 두어야 왕복이 짧습니다) |
| Instance Type | **Free** |
| Health Check Path | **`/actuator/health/alive`** ← ⚠️ `/actuator/health`가 아님 (`../../docs/COST_GUARDRAILS.md §3.2`) |

> ### ⚠️ Dockerfile Path는 **Root Directory 기준**입니다 (경로를 두 번 쓰면 실패)
>
> Render 문서가 명시합니다 — "All of the following settings operate relative to
> the root directory: … **Dockerfile path**, Docker build context directory."
>
> | Root Directory | Dockerfile Path | 실제로 찾는 경로 | 결과 |
> |---|---|---|---|
> | `backend` | `backend/Dockerfile` | `backend/backend/Dockerfile` | ❌ **빌드 즉시 실패** |
> | `backend` | **`Dockerfile`** | `backend/Dockerfile` | ✅ |
> | (비움) | `backend/Dockerfile` | `backend/Dockerfile` | ⚠️ 파일은 찾지만 **빌드 컨텍스트가 저장소 루트**가 되어 `COPY gradlew …`가 실패합니다 |
>
> **Root Directory를 `backend`로 두는 것이 맞습니다** — `backend/Dockerfile`의
> `COPY` 경로가 전부 `backend/` 기준으로 쓰여 있어서, 빌드 컨텍스트가
> `backend/`여야 합니다.
>
> 🔴 **2026-08-27 정정**: 이 표가 이전에는 `backend/Dockerfile`로 적혀 있었습니다.
> 그대로 설정하면 배포가 실패합니다.

### ③ 환경 변수 — **지금은 5개면 됩니다**

Render 서비스 → Environment → Add Environment Variable

| 변수 | 값 |
|---|---|
| `SPRING_PROFILES_ACTIVE` | `prod` |
| `DATABASE_URL` | 위 ①에서 만든 **JDBC 형식** 주소 |
| `DB_USERNAME` | Neon 사용자명 |
| `DB_PASSWORD` | Neon 비밀번호 |
| `JWT_SECRET` | **256비트 이상 랜덤 문자열** (아래 참고) |

`JWT_SECRET` 만들기 — 아무 값이나 쓰지 마세요:
```bash
openssl rand -base64 48
```

> ### ⚠️ Kakao·R2·Mail 변수 12개는 **지금 넣지 마세요**
>
> `ARCHITECTURE.md §9`에 17개가 적혀 있지만, **코드가 실제로 참조하는 것은 위 5개뿐입니다**
> (`application.yml`의 `${...}` 전수 확인 결과 — 나머지는 `JWT_ACCESS_TTL`·
> `JWT_REFRESH_TTL`이고 둘 다 기본값이 있습니다).
>
> Kakao 로그인·R2 업로드·메일 발송은 **아직 코드가 없습니다**(M2~M4). 지금 넣으면
> 쓰지도 않는 서비스의 계정을 미리 만들고 시크릿을 관리하게 됩니다.
> **각 기능을 구현하는 시점에 그때 추가하세요.**

### ④ ★ Auto-Deploy 끄기

Render 서비스 → Settings → **Auto-Deploy: `Off`**

**이걸 안 끄면 이번 작업이 전부 무의미해집니다.** 켜져 있으면 Render가 `develop`
push를 보는 즉시 배포합니다 — 테스트를 기다리지 않으므로, 깨진 코드가 그대로
서버에 올라갑니다. **테스트를 통과한 커밋만 배포되게 하려면 트리거가 하나여야 합니다.**
(`CICD.md §5.2`)

### ⑤ Deploy Hook → **GitHub 저장소 시크릿**으로 등록

Render 서비스 → Settings → **Deploy Hook** → URL 복사

그 URL을 **GitHub에 등록합니다** (Jenkins가 아닙니다 — 2026-08-26에 트리거가 옮겨졌습니다):

```
GitHub 저장소 → Settings → Secrets and variables → Actions
  → New repository secret
     Name:   RENDER_DEPLOY_HOOK
     Secret: (복사한 URL)
```

> 이름이 정확히 `RENDER_DEPLOY_HOOK`이어야 합니다 — 워크플로가 이 이름으로 읽습니다.
> 없으면 배포 잡이 "시크릿이 없습니다"라고 실패하며 멈춥니다(조용히 넘어가지 않습니다).

### ⑥ 슬립 방지 핑

Render Free는 **15분 유휴 시 슬립**하고, 깨어날 때 JVM 콜드스타트가 30~60초 걸립니다.

https://cron-job.org (무료) → 새 작업

| 항목 | 값 |
|---|---|
| URL | `https://light-homepage.onrender.com/actuator/health/alive` |
| 스케줄 | **`*/10 6-23 * * *`** (10분마다, 06:00~23:59만) |
| **Timezone** | **`Asia/Seoul`** ← ⚠️ 아래 참고 |

> ### ⚠️ Timezone을 반드시 `Asia/Seoul`로 바꾸세요
>
> cron-job.org의 기본값은 **UTC**입니다. 그대로 두면 `6-23`이 UTC 기준이 되어
> **한국 시간 15:00~08:59**에 핑이 돕니다 — 정확히 사람들이 안 쓰는 시간에
> 깨우고, **주일 오전 예배 시간(09~12시)에 슬립합니다.**

> ### ⚠️ 경로를 `/actuator/health`로 두면 안 됩니다
>
> `/actuator/health`는 **DB 상태까지 확인합니다.** 10분마다 그쪽을 때리면
> Neon(DB)이 **한 번도 자동 정지되지 않아** 무료 컴퓨트 한도를 넘깁니다.
> `/actuator/health/alive`는 DB를 건드리지 않습니다
> (`../../docs/COST_GUARDRAILS.md §3.2`).
>
> 이 실수는 **아무 증상이 없습니다** — 사이트도 API도 정상으로 보이고,
> Neon 사용량으로만 드러납니다.

> ### 왜 24시간이 아니라 06:00~24:00인가 (PM 결정 2026-08-27)
>
> | 방식 | 월 사용 | 여유 | 대가 |
> |---|---|---|---|
> | 24시간 상시 | 744h | **6h** ⚠️ | 없음 |
> | **06:00~24:00** ★ | **558h** | **192h** | 새벽 첫 방문자만 콜드스타트 |
>
> 한도는 **750 인스턴스시간/월**입니다. 24시간 가동은 744시간(99.2%)이라
> 여유가 6시간뿐인데, **배포할 때 새 인스턴스와 기존 인스턴스가 잠깐 겹쳐
> 도는 시간**이 여기에 쌓입니다. 한도를 넘기면 (카드가 없으므로) 과금이 아니라
> **서비스가 정지**됩니다 — **"상시"를 노린 설정이 월말에 서비스를 멈추게 하는**
> 셈입니다.
>
> 교회 사이트라 새벽 트래픽은 사실상 0이고, **06:00 핑이 사람들이 오기 전에
> 서버를 깨워둡니다.** 상세는 `../../docs/COST_GUARDRAILS.md §3.3`.

> **그래서 스테이징 서버를 따로 둘 수 없습니다** — 두 개면 한도를 넘습니다.

---

## 2. 확인

> ### ✅ 2026-08-27 배포 성공 — 아래는 실측값입니다
>
> **서비스 주소: `https://light-homepage.onrender.com`**
>
> 서비스 이름과 주소가 같습니다(Render가 접미사를 붙이지 않았습니다).

```bash
# 슬립 방지 핑·Render 헬스체크가 쓰는 경로 (DB를 건드리지 않습니다)
curl -i https://light-homepage.onrender.com/actuator/health/alive
# → HTTP 200  {"status":"UP"}

# DB까지 확인하는 진단용 경로 — 사람이 필요할 때만 부릅니다
curl -i https://light-homepage.onrender.com/actuator/health
# → HTTP 200  {"status":"UP","groups":["alive","liveness","readiness"]}
```

### 2026-08-27 실측 결과 전체

| 경로 | 실측 | 뜻 |
|---|---|---|
| `/actuator/health/alive` | **200** `{"status":"UP"}` | 핑 대상이 열려 있음 — **인증 없이** 통과 |
| `/actuator/health` | **200** `groups:["alive","liveness","readiness"]` | ★ **DB까지 UP** — `DATABASE_URL` JDBC 형식·SSL·비밀번호·Flyway 전부 통과 |
| `/api/posts?category=NOTICE_PUBLIC` | **200** `{"items":[],...}` | ★ HTTP → 서비스 → Neon 읽기 전 구간 동작 (글이 없어 빈 배열) |
| `/api/posts?category=NOTICE_MEMBER` | 401 | 인가 정상 |
| `/api/posts?category=BUDGET` | 401 | 인가 정상 (`PostAuthorizationTest:68` 익명 = `UNAUTHORIZED`) |
| `/` | 401 | 정상 — Spring Security 기본 설정 |
| `/swagger-ui.html` · `/v3/api-docs` | 404 | 정상 — `prod`에서 계약서를 공개하지 않습니다 |
| `/actuator/env` | 401 | 정상 — `include: health`만 노출 |
| 응답 헤더 | `x-render-origin-server: Render` | suspend 상태가 아님 |

> ⚠️ **`category` 값을 주의하세요.** `NOTICE`가 아니라 **`NOTICE_PUBLIC`**입니다
> (`PostCategory.java`). 틀리면 `400 VALIDATION_ERROR`가 옵니다 — 서버 문제로
> 오해하기 쉽습니다.

`{"status":"UP"}`이 나오면 끝입니다. 그다음부터는 BE가 `develop`에 머지할 때마다
자동으로 올라갑니다.

> ### 이번 배포가 실패했던 원인 (기록)
>
> 첫 배포 시도는 **failed deploy**였습니다. 원인은 이 문서였습니다 —
> `Dockerfile Path`를 `backend/Dockerfile`로 안내했는데, Render는 그 값을
> **Root Directory 기준**으로 해석해 `backend/backend/Dockerfile`을 찾습니다
> (§1② 참고). **`Dockerfile`로 고치고 재배포하니 통과했습니다.** 첫 빌드는
> 캐시가 없어 약 5분 걸렸습니다.
>
> ⚠️ 그 사이 GitHub Actions의 `deploy` 잡은 **두 번 모두 초록불**이었습니다.
> 훅 호출까지만 하기 때문입니다 (§2.5).

---

## 2.5 배포가 실패했을 때 — 어디를 보는가

Render 대시보드 → 서비스 → **Events** → 실패한 배포 클릭 → **Logs**.
**어느 단계에서 멈췄는지**로 원인이 갈립니다.

| 로그에 보이는 것 | 원인 | 고치는 곳 |
|---|---|---|
| `failed to read dockerfile` · `no such file or directory` | **Dockerfile Path를 Root Directory 기준으로 안 씀** (§1② 함정) | Render Settings → Dockerfile Path = `Dockerfile` |
| `COPY gradlew … not found` | Root Directory가 비어 있어 빌드 컨텍스트가 저장소 루트다 | Root Directory = `backend` |
| `gradlew: not found` · `bad interpreter` | 드문 경우 — `gradlew` 줄바꿈이 CRLF | 저장소에는 LF로 저장돼 있어야 함 |
| Gradle 컴파일 에러 | 코드 문제 | ⚠️ CI가 통과했다면 여기서 날 이유가 없다. 브랜치를 확인할 것 |
| `Driver claims to not accept jdbcUrl` | `DATABASE_URL`에 `jdbc:` 접두사가 없음 | Environment (§1①) |
| 인증 실패 · `password authentication failed` | 아이디·비밀번호가 URL에 남아 있음 | 같음 |
| 기동은 됐는데 `Health check failed` | Health Check Path가 틀림 | Settings → `/actuator/health/alive` |
| `Exited with status 137` | 메모리 초과(OOM) | `-Xmx400m`을 낮춰야 하는지 확인 |

> ### ⚠️ 배포 실패는 GitHub Actions에서 초록불로 보입니다
>
> `deploy` 잡은 **훅을 호출하는 것까지만** 합니다. Render가 그 뒤에 이미지를
> 빌드하다 실패해도 Actions는 **success**입니다. 같은 이유로 서비스가
> `Suspended`여도 훅은 200을 반환합니다
> (`../../docs/COST_GUARDRAILS.md §4`).
>
> **그래서 배포 확인은 훅 결과가 아니라 실제 응답으로 합니다** (§2).

---

## 3. 로컬에서 미리 돌려보기 (선택)

배포 전에 이미지가 실제로 뜨는지 확인하고 싶다면:

```bash
docker network create light-local
docker run -d --name light-db --network light-local \
  -e POSTGRES_DB=light -e POSTGRES_USER=light -e POSTGRES_PASSWORD=lightpw postgres:16

cd backend && docker build -t light-api .
docker run --rm --network light-local -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e DATABASE_URL="jdbc:postgresql://light-db:5432/light" \
  -e DB_USERNAME=light -e DB_PASSWORD=lightpw \
  -e JWT_SECRET="$(openssl rand -base64 48)" \
  light-api

curl localhost:8080/actuator/health/alive   # → {"status":"UP"}  (DB 미접근)
curl localhost:8080/actuator/health         # → {"status":"UP"}  (DB 포함)
```

> 이 절차는 2026-08-26에 실제로 돌려서 확인했습니다 — Flyway V1 적용,
> 헬스체크 200, 기동 8.6초, 메모리 299MB(상한 400MB 안), 이미지 442MB.

---

## 4. 알아둘 것

| 항목 | 내용 |
|---|---|
| **첫 배포는 백엔드가 `develop`에 들어온 뒤** | 지금 `develop`의 `backend/`에는 `README.md`와 `Dockerfile`뿐입니다. BE가 `backend_develop → develop`을 머지해야 배포할 것이 생깁니다 |
| **메모리 400MB 상한** | `Dockerfile`의 `-Xmx400m`. Render Free 512MB 한도라 임의로 못 늘립니다. 늘리려면 호스팅부터 다시 정해야 합니다 (`ARCHITECTURE.md §8.1`). ⚠️ 힙 400m + 힙 밖 약 180m은 **이미 512MB를 넘습니다** — §5 참고 |
| **★ 최적화 설정 (2026-08-27)** | 콜드스타트·재배포·메모리·Neon 풀. 아래 §5에 무엇을 왜 넣었는지 있습니다 |
| **배포 브랜치를 main으로 옮길 때** | 공개 시점에 ①Render 서비스의 Branch를 `main`으로 ②`backend-ci.yml`의 `deploy` 잡 조건을 `refs/heads/main`으로. 두 곳을 같이 바꿔야 합니다 |
| **월례회 PDF 변환(M4)** | 이미지에 폰트(`fontconfig`·`ttf-dejavu`)를 미리 넣어뒀습니다. 폰트가 없으면 PDFBox가 렌더링 시점에 죽는데, 그 시점이 "임원이 자료를 올리는 순간"이라 가장 늦게 발견됩니다. ⚠️ **다만 DejaVu에는 한글 글리프가 없습니다** — M4에서 한글 PDF는 "죽지는 않고 □□□로 나옵니다". 그때 한글 폰트를 추가해야 합니다 |

---

## 5. 최적화 설정 — 무엇을 왜 넣었는가 (2026-08-27)

배포는 성공했지만 **새벽 슬립 후 첫 방문자가 30~60초를 기다립니다.** 그리고
지금 배포가 잦아서 재배포 중 요청이 끊길 수 있고, 512MB는 여유가 없습니다.
비용을 늘리지 않고 손볼 수 있는 것만 골랐습니다.

| 우선순위 | 무엇 | 어디 | 기대 효과 |
|---|---|---|---|
| ① 콜드스타트 | `-Xms128m` | `Dockerfile` | ⚠️ **-Xms가 없으면 초기 힙이 8MB**입니다. Spring 기동이 그 안에서 힙 확장·young GC를 수십 번 반복합니다 |
| ① 콜드스타트 | `min-spare: 5` | `application.yml` | 기동 시 만드는 스레드 10 → 5 |
| ② 요청 유실 | `timeout-per-shutdown-phase: 20s` | `application.yml` | 기본값 30초는 **Render의 강제 종료 시한과 같습니다** |
| ② 요청 유실 | `shutdown: graceful` (명시) | `application.yml` | Boot 3.5부터 기본값이지만, 깨지면 요청이 소리 없이 사라집니다 |
| ③ 메모리 | `threads.max: 20` (기본 200) | `application.yml` | 스레드 스택은 **힙 밖** 메모리입니다 |
| ③ 메모리 | `-XX:+UseSerialGC` | `Dockerfile` | JVM은 CPU 개수로 GC를 고릅니다 — 2 CPU가 되면 조용히 G1로 넘어갑니다 |
| ④ **과금** | `keepalive-time: 0` 외 2줄 | `application.yml` | ★ **커넥션 풀이 Neon을 상시 가동시키고 있었습니다** — `../../docs/COST_GUARDRAILS.md §3.2` |
| ⑤ 응답 크기 | `compression.enabled: true` | `application.yml` | ⚠️ **효과가 확인되지 않았습니다 — 아래 실측 참고** |

> ### ⚠️ `-Xmx400m`은 여유가 없습니다 — 늘릴 수 없을 뿐 아니라 이미 빡빡합니다
>
> 힙 400MB + 힙 밖(메타스페이스·코드캐시·스레드 스택) 약 180MB면 **합계가
> 512MB를 넘습니다.** 힙이 정말 400MB까지 차면 `Exited with status 137`로
> 죽습니다. 지금 안 죽는 이유는 힙을 그만큼 쓰지 않아서일 뿐입니다(실측 299MB).
>
> **`-Xmx`를 낮추지 않은 이유**: M4의 PDF→페이지 이미지 변환이 힙을 씁니다.
> 낮추면 그쪽이 막힙니다. 대신 **힙 밖을 줄였고**(스레드·GC),
> `../../docs/COST_GUARDRAILS.md §5`의 월례 확인에 **메모리 420MB 경고선**을
> 넣었습니다.

> ### ⚠️ 효과 수치는 아직 실측이 아닙니다
>
> 2026-08-27 시점에 **로컬 Docker 데몬이 꺼져 있어** 이미지 빌드·기동 시간·
> 메모리를 다시 재지 못했습니다. 설정값이 실제로 적용되는지는 Spring 바인딩까지
> 확인했지만, **8.6초가 몇 초가 되는지는 배포 후 Render → Metrics / Logs로
> 확인해야 합니다.** 확인하면 §2의 실측표에 추가하세요.
>
> 배포 후 볼 것:
> ```bash
> # 재배포 중에도 응답이 끊기지 않는지 (graceful shutdown 확인)
> curl -s -o /dev/null -w "%{http_code}\n" https://light-homepage.onrender.com/actuator/health/alive
>
> curl -s -H "Accept-Encoding: gzip" -D - -o /dev/null \
>   "https://light-homepage.onrender.com/api/posts?category=NOTICE_PUBLIC"
> ```
>
> 그리고 **Neon → Compute 그래프에 빈 구간이 생겼는지**가 ④가 실제로 막혔다는
> 유일한 증거입니다.

### 2026-08-27 배포 후 실측 (최적화 적용분)

| 확인 | 결과 | 해석 |
|---|---|---|
| `/actuator/health/alive` | 200 / **0.58초** | 정상 |
| `/actuator/health` (DB 포함) | 200 / **1.37초** | ⚠️ **예상된 대가입니다** — `minimum-idle: 0`으로 유휴 시 풀을 비우므로 첫 DB 쿼리가 커넥션을 새로 맺습니다. Neon을 자동 정지시키기 위해 지불하는 비용입니다 |

> ### ⚠️ ⑤ 응답 압축은 우리 설정의 효과인지 확인되지 않았습니다
>
> `Content-Encoding: gzip`은 붙지만 **우리 설정 때문이 아닐 가능성이 높습니다.**
>
> | 응답 | 크기 | gzip |
> |---|---|---|
> | `/api/posts` (`application/json`) | 약 55B | ✅ 붙음 |
> | `/actuator/health/alive` (actuator vendor 타입) | 약 15B | ❌ 안 붙음 |
>
> **둘 다 2KB 미만인데 결과가 갈립니다.** Spring 압축은 기본 2KB 기준이라
> **둘 다 압축하지 않아야 합니다.** content-type으로 갈리는 이 패턴은
> **Render 앞단의 Cloudflare** 동작과 일치합니다(응답 헤더 `Server: cloudflare`).
>
> → `compression.enabled: true`는 **실질적으로 no-op일 수 있습니다.** 해롭지는
> 않지만 이득을 주장할 근거가 없습니다. **2KB를 넘는 실데이터가 생긴 뒤 다시
> 측정해야** 확정됩니다.

