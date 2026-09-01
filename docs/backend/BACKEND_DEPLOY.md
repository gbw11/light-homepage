# 백엔드 배포 규약 — Docker/Render

> 대상: 백엔드 담당자. `backend/`에 Spring 프로젝트를 만들 때 이 규약을
> 지키면, 별도 협의 없이 바로 Render에 Docker로 배포할 수 있습니다.
> 배경: [`ARCHITECTURE.md §8.1`](../spec/ARCHITECTURE.md) · [`CICD.md §5`](../ops/CICD.md) ·
> Render 서비스 세팅 절차는 [`../infra/render/README.md`](../../infra/render/README.md)
> (인프라 담당 소유, 백엔드는 여기 규약만 지키면 됩니다).

---

## 1. 백엔드가 해야 할 일은 **없습니다**

`backend/Dockerfile`은 **인프라가 이미 만들어 커밋했습니다**(2026-08-26).
`feat/be-schema` 코드로 실제 빌드·기동까지 확인했습니다 — Flyway V1 적용,
헬스체크 200, 기동 8.6초, 메모리 299MB.

**`backend_develop`을 `develop`에 머지하면 그때부터 자동 배포됩니다.**
그 외에 백엔드에서 할 조작은 없습니다.

아래는 "왜 이렇게 돼 있는지"와 **바꾸면 안 되는 것**의 설명입니다.

> ⚠️ `backend/Dockerfile`은 `backend/` 안에 있지만 **인프라 소유**입니다
> (`INTEGRATION.md §6.3`이 `backend/Dockerfile`을 `server_develop`에 배정).
> 고쳐야 할 일이 생기면 먼저 알려주세요.

---

## 2. Dockerfile

실제 파일: [`../backend/Dockerfile`](../../backend/Dockerfile) (템플릿은 제거됐습니다)

| 항목 | 값 | 이유 |
|---|---|---|
| 빌드 도구 | **Gradle Wrapper** (`./gradlew`) | `TOOLCHAIN.md §1`이 "Wrapper 사용, 별도 설치 금지". `gradle:8-jdk21` 이미지를 쓰면 로컬·CI(8.14.3)와 버전이 갈린다 |
| 빌드 | `bootJar -x test` | 테스트는 CI에서 이미 돌았다. 이미지 빌드가 테스트 실패로 깨지면 원인이 두 곳으로 갈린다 |
| 런타임 베이스 | `eclipse-temurin:21-jre-alpine` | JRE만 — 이미지 442MB |
| **폰트** | `fontconfig` · `ttf-dejavu` | **M4 월례회 PDF→이미지(PDFBox)용.** alpine JRE는 폰트가 없어 AWT 폰트 코드가 처음 불릴 때 `Fontconfig head is null`로 죽는다. 그 시점이 "임원이 자료를 올리는 순간"이라 가장 늦게 발견된다 |
| 메모리 | `-Xmx400m` | Render Free 512MB 한도 (`ARCHITECTURE.md §8.1`). 실측 299MB |
| 포트 | `${PORT:-8080}` | Render가 `PORT`로 수신 포트를 지정한다. 로컬은 8080 그대로 |
| 실행 사용자 | 비루트(`light`) | 컨테이너가 뚫렸을 때 할 수 있는 일을 줄인다 |
| 신호 처리 | `exec java ...` | java가 PID 1이 되어 SIGTERM을 직접 받는다. 없으면 재배포 때 처리 중이던 요청이 끊긴다 |

**바뀌면 안 되는 것**: `-Xmx400m` 상한, `PORT` 존중, 헬스체크 경로.
메모리 제약은 프로젝트 전제라 임의로 못 늘립니다 (`ARCHITECTURE.md §8`).

**앞으로 바뀔 수 있는 것**: M4에서 PDF 렌더링 품질 문제가 나오면 런타임 베이스를
`eclipse-temurin:21-jre-jammy`(Debian)로 바꿉니다. 이미지가 커지는 대신 폰트
환경이 안정적입니다.

---

## 3. 헬스체크

`/actuator/health`가 `200 OK`를 반환해야 합니다. `backend/README.md`
의존성 목록에 이미 있는 **Spring Boot Actuator**만 추가하면 기본으로 됩니다.

- Render의 헬스체크와 cron-job.org 슬립 방지 핑이 이 엔드포인트를 씁니다
  (`ARCHITECTURE.md §8.1`)
- 커스텀 헬스 인디케이터를 추가해도 되지만, 응답이 무거워지면(DB 풀 전체
  스캔 등) 슬립 방지 핑 주기(10분)와 충돌할 수 있으니 가볍게 유지하세요

---

## 4. 환경 변수 (컨테이너가 실행 시점에 주입받는 값)

이미지 안에 값을 넣지 마세요 — 전부 Render 대시보드에서 주입됩니다.

**지금 실제로 필요한 것은 5개뿐입니다.** `application.yml`의 `${...}` 참조를
전수 확인한 결과입니다 (2026-08-26).

```
SPRING_PROFILES_ACTIVE=prod
DATABASE_URL / DB_USERNAME / DB_PASSWORD
JWT_SECRET
```

`JWT_ACCESS_TTL`·`JWT_REFRESH_TTL`은 기본값(1800 / 1209600)이 있어 생략 가능합니다.

⚠️ `ARCHITECTURE.md §9`에는 17개가 적혀 있지만 **Kakao·R2·Mail 12개는 아직 어떤
코드도 참조하지 않습니다**(M2~M4). 미리 넣으면 쓰지도 않는 서비스의 계정을 만들고
시크릿을 관리하게 됩니다 — **각 기능을 구현하는 PR에서 그때 추가하세요.**
새 변수를 도입하면 `infra/render/README.md §1③`에도 한 줄 추가해 주세요.

- `application-prod.yml`은 이 값들을 `${DATABASE_URL}` 형태로 참조만 하고,
  **실제 값을 커밋하지 않습니다** (이미 `.gitignore`에 있음)
- HikariCP `maximum-pool-size: 3` 고정 — Neon 무료 티어 연결 수 제한
  (`ARCHITECTURE.md §8.2`). 기본값(10)으로 두면 배포 후 연결 고갈로 장애 남

---

## 5. 로컬에서 미리 검증하는 법

PR 올리기 전에 이 컨테이너가 실제로 뜨는지 직접 확인할 수 있습니다.

DB가 있어야 뜹니다 (Flyway가 마이그레이션을 돌리고 JPA가 스키마를 검증합니다).

```bash
docker network create light-local
docker run -d --name light-db --network light-local   -e POSTGRES_DB=light -e POSTGRES_USER=light -e POSTGRES_PASSWORD=lightpw postgres:16

cd backend && docker build -t light-api-test .
docker run --rm --network light-local -p 8080:8080   -e SPRING_PROFILES_ACTIVE=prod   -e DATABASE_URL="jdbc:postgresql://light-db:5432/light"   -e DB_USERNAME=light -e DB_PASSWORD=lightpw   -e JWT_SECRET="$(openssl rand -base64 48)"   light-api-test

curl localhost:8080/actuator/health   # {"status":"UP"}
```

⚠️ `DATABASE_URL`은 **`jdbc:` 접두사가 붙은 JDBC 형식**이고 아이디·비밀번호를
포함하지 않습니다. Neon이 주는 `postgres://user:pass@...` 형식을 그대로 넣으면
`Driver claims to not accept jdbcUrl`로 죽습니다 (`infra/render/README.md §1①`).

---

## 6. 이 규약이 지켜지면 벌어지는 일

**`develop`에 머지되면** GitHub Actions가 테스트를 돌리고, 통과하면 Render
Deploy Hook을 호출합니다. Render가 `backend/Dockerfile`로 이미지를 빌드해
배포합니다 (`CICD.md §5`).

```
feat/be-*  →  backend_develop  →  develop  ──▶ Actions(build+test) ──▶ 🚀 Render
```

- ⚠️ **`main`이 아니라 `develop`입니다** (PM 결정 2026-08-26). 공개 시점에 옮깁니다
- ⚠️ **Jenkins가 아니라 GitHub Actions입니다** — Jenkins는 PM 로컬 PC에 있어
  PC가 꺼져 있으면 배포가 안 됩니다. Jenkins는 CI 검증 역할로 남습니다
- 백엔드 쪽에서 배포 스크립트를 만들 필요가 없습니다

Render 서비스 생성·환경변수·Deploy Hook 등록은 인프라(PM) 몫입니다
([`infra/render/README.md`](../../infra/render/README.md)).
