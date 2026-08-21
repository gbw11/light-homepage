# 백엔드 배포 규약 — Docker/Render

> 대상: 백엔드 담당자. `backend/`에 Spring 프로젝트를 만들 때 이 규약을
> 지키면, 별도 협의 없이 바로 Render에 Docker로 배포할 수 있습니다.
> 배경: [`ARCHITECTURE.md §8.1`](ARCHITECTURE.md) · [`CICD.md §5`](CICD.md) ·
> Render 서비스 세팅 절차는 [`../infra/render/README.md`](../infra/render/README.md)
> (인프라 담당 소유, 백엔드는 여기 규약만 지키면 됩니다).

---

## 1. 지금 당장 할 일은 없습니다

이 문서는 **미리 정해두는 규약**입니다. 프로젝트를 start.spring.io로
만드는 시점에, 아래 항목만 지키면서 진행하면 됩니다.

---

## 2. Dockerfile

`backend/Dockerfile`을 만들 때
[`infra/render/Dockerfile.backend.template`](../infra/render/Dockerfile.backend.template)를
그대로 복사해서 시작하세요. 이미 다음을 반영해 뒀습니다.

| 항목 | 값 | 이유 |
|---|---|---|
| 빌드 | `gradle bootJar --no-daemon -x test` | 이미지 빌드 시 테스트 재실행 안 함 (CI에서 이미 검증) |
| 런타임 베이스 | `eclipse-temurin:21-jre-alpine` | JDK 대신 JRE만 포함 — 이미지 작게 |
| 메모리 | `-Xmx400m` | Render Free 512MB 한도 (`ARCHITECTURE.md §8.1`) |
| 포트 | `8080` (`EXPOSE`) | 고정값 (`TOOLCHAIN.md`) — 바꾸지 마세요 |

**바뀌면 안 되는 것**: 포트, `-Xmx400m` 상한. 필요하면 먼저 알려주세요
(메모리 제약이 프로젝트 전제라 임의로 늘릴 수 없습니다 — `ARCHITECTURE.md §8`).

**자유롭게 바뀌어도 되는 것**: 빌드 스테이지 베이스 이미지 버전, 캐시
레이어 최적화 등 — 위 표의 결과만 지키면 구현 방식은 자유입니다.

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

이미지 안에 값을 넣지 마세요 — 전부 Render 대시보드에서 환경 변수로
주입됩니다. 목록은 [`ARCHITECTURE.md §9`](ARCHITECTURE.md)와
[`backend/README.md`](../backend/README.md) 두 곳에 이미 있고 동일합니다.

```
SPRING_PROFILES_ACTIVE=prod
DATABASE_URL / DB_USERNAME / DB_PASSWORD
JWT_SECRET / JWT_ACCESS_TTL / JWT_REFRESH_TTL
KAKAO_CLIENT_ID / KAKAO_CLIENT_SECRET / KAKAO_REDIRECT_URI
R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET / R2_ENDPOINT
MAIL_API_KEY / NOTIFY_EMAIL
```

- `application-prod.yml`은 이 값들을 `${DATABASE_URL}` 형태로 참조만 하고,
  **실제 값을 커밋하지 않습니다** (이미 `.gitignore`에 있음)
- HikariCP `maximum-pool-size: 3` 고정 — Neon 무료 티어 연결 수 제한
  (`ARCHITECTURE.md §8.2`). 기본값(10)으로 두면 배포 후 연결 고갈로 장애 남

---

## 5. 로컬에서 미리 검증하는 법

PR 올리기 전에 이 컨테이너가 실제로 뜨는지 직접 확인할 수 있습니다.

```bash
cd backend
docker build -t light-api-test .
docker run --rm -p 8080:8080 --env-file .env.docker-test light-api-test
curl localhost:8080/actuator/health   # {"status":"UP"} 확인
```

`.env.docker-test`는 로컬 전용 더미 값(커밋 금지, 이미 `.gitignore`의
`.env*` 규칙에 걸립니다)으로 §4 목록을 채우면 됩니다.

---

## 6. 이 규약이 지켜지면 벌어지는 일

`main` 브랜치에 머지되면 Jenkins가 테스트 통과 후 Render Deploy Hook을
호출하고, Render가 `backend/Dockerfile`로 이미지를 빌드해 그대로
배포합니다 (`CICD.md §5`). 백엔드 쪽에서 별도로 배포 스크립트를 만들
필요가 없습니다 — 위 규약만 지키면 됩니다.

Render 서비스 자체 생성(계정 연결, Deploy Hook 발급 등)은 인프라 담당이
배포 직전에 진행합니다 ([`infra/render/README.md`](../infra/render/README.md)).
