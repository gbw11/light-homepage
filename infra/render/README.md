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
| Dockerfile Path | `backend/Dockerfile` |
| Region | **Singapore** (Neon과 같은 리전에 두어야 왕복이 짧습니다) |
| Instance Type | **Free** |
| Health Check Path | **`/actuator/health/alive`** ← ⚠️ `/actuator/health`가 아님 (`../../docs/COST_GUARDRAILS.md §3.2`) |

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
- URL: `https://<서비스명>.onrender.com/actuator/health/alive`
- 주기: **10분**

> ### ⚠️ 경로를 `/actuator/health`로 두면 안 됩니다
>
> `/actuator/health`는 **DB 상태까지 확인합니다.** 10분마다 그쪽을 때리면
> Neon(DB)이 **한 번도 자동 정지되지 않아** 무료 컴퓨트 한도를 넘깁니다.
> `/actuator/health/alive`는 DB를 건드리지 않습니다
> (`../../docs/COST_GUARDRAILS.md §3.2`).
>
> 이 실수는 **아무 증상이 없습니다** — 사이트도 API도 정상으로 보이고,
> Neon 사용량으로만 드러납니다.

> 750시간/월 = 서비스 하나를 24시간 켜두는 양입니다. 핑을 넣어도 한도 안에 있습니다.
> 다만 **여유가 6시간뿐입니다**(744/750). **그래서 스테이징 서버를 따로 둘 수
> 없습니다** — 두 개면 1,488시간이라 한도를 넘습니다.

---

## 2. 확인

```bash
# 슬립 방지 핑·Render 헬스체크가 쓰는 경로 (DB를 건드리지 않습니다)
curl -i https://<서비스명>.onrender.com/actuator/health/alive
# → HTTP 200  {"status":"UP"}

# DB까지 확인하는 진단용 경로 — 사람이 필요할 때만 부릅니다
curl -i https://<서비스명>.onrender.com/actuator/health
# → HTTP 200  {"status":"UP","groups":[...]}
```

`{"status":"UP"}`이 나오면 끝입니다. 그다음부터는 BE가 `develop`에 머지할 때마다
자동으로 올라갑니다.

**루트(`/`)가 401을 주는 것은 정상입니다** — Spring Security 기본 설정이라
BE가 인증을 구현하면서 바뀝니다.

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
| **메모리 400MB 상한** | `Dockerfile`의 `-Xmx400m`. Render Free 512MB 한도라 임의로 못 늘립니다. 늘리려면 호스팅부터 다시 정해야 합니다 (`ARCHITECTURE.md §8.1`) |
| **배포 브랜치를 main으로 옮길 때** | 공개 시점에 ①Render 서비스의 Branch를 `main`으로 ②`backend-ci.yml`의 `deploy` 잡 조건을 `refs/heads/main`으로. 두 곳을 같이 바꿔야 합니다 |
| **월례회 PDF 변환(M4)** | 이미지에 폰트(`fontconfig`·`ttf-dejavu`)를 미리 넣어뒀습니다. 폰트가 없으면 PDFBox가 렌더링 시점에 죽는데, 그 시점이 "임원이 자료를 올리는 순간"이라 가장 늦게 발견됩니다 |
