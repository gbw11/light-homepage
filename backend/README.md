# backend — Spring Boot

**소유: 백엔드 담당자** (프론트엔드는 이 디렉터리를 수정하지 않습니다)

> 👋 **처음 오셨다면 → [`../docs/backend/ONBOARDING_BACKEND.md`](../docs/backend/ONBOARDING_BACKEND.md)** (어떤 파일을 어떤 순서로 읽을지)
> 📋 **작업 지시서: [`../docs/backend/BACKEND_TASKS.md`](../docs/backend/BACKEND_TASKS.md)**
> 이 문서만 읽어도 작업할 수 있게 정리돼 있습니다. 먼저 [`../docs/ops/INTEGRATION.md`](../docs/ops/INTEGRATION.md)를 읽어주세요.
> ⚙️ 설치할 도구와 버전은 [`../docs/ops/TOOLCHAIN.md`](../docs/ops/TOOLCHAIN.md) — **Java 21 Temurin · Postgres 16 · 포트 8080 고정**

---

## 초기화 (W0에서 1회)

[start.spring.io](https://start.spring.io) 설정:

| 항목 | 값 |
|---|---|
| Project | **Gradle - Groovy** |
| Language | **Java** |
| Spring Boot | 3.x (최신 안정) |
| Group | `kr.light` |
| Artifact | `light-api` |
| Packaging | Jar |
| Java | **21** |

**Dependencies**
- Spring Web
- Spring Security
- Spring Data JPA
- PostgreSQL Driver
- Flyway Migration
- Validation
- Spring Boot Actuator (헬스체크 — Render 슬립 방지용)
- Lombok

**추가 의존성** (`build.gradle`)
```gradle
// JWT
implementation 'io.jsonwebtoken:jjwt-api:0.12.6'
runtimeOnly   'io.jsonwebtoken:jjwt-impl:0.12.6'
runtimeOnly   'io.jsonwebtoken:jjwt-jackson:0.12.6'

// API 문서 (FE와의 계약서)
implementation 'org.springdoc:springdoc-openapi-starter-webmvc-ui:2.6.0'

// Cloudflare R2 (S3 호환)
implementation platform('software.amazon.awssdk:bom:2.28.0')
implementation 'software.amazon.awssdk:s3'
implementation 'software.amazon.awssdk:s3-transfer-manager'

// 월례회: PDF → 페이지 이미지
implementation 'org.apache.pdfbox:pdfbox:3.0.3'

// 테스트
testImplementation 'org.springframework.security:spring-security-test'
```

---

## 예정 패키지 구조

```
backend/src/main/java/kr/light/
├─ LightApplication.java
├─ config/       SecurityConfig · JwtConfig · R2Config · OpenApiConfig
├─ auth/         controller · service · jwt · oauth(kakao) · dto
├─ member/       entity · repository · service · controller(admin)
├─ post/         entity · repository · PostQueryService(★단일 관문) · controller
├─ bulletin/
├─ album/ photo/ upload(issue·commit) · download
├─ meeting/      ★ 월례회 (PDF변환 · 워터마크 · 기간검사 · 열람로그)
├─ attachment/
├─ storage/      R2Client · Presigner · UsageService
├─ newcomer/
└─ common/       ApiResponse · GlobalExceptionHandler · AuditLogger

backend/src/main/resources/
├─ db/migration/          V1__init.sql ...   (Flyway)
├─ application.yml
├─ application-local.yml  ★ .gitignore (시크릿)
└─ application-prod.yml   ★ .gitignore
```

---

## ⚠️ 무료 인프라 제약 (먼저 알아둘 것)

| 항목 | 제약 | 대응 |
|---|---|---|
| Render Free | 메모리 **512MB** | `-Xmx400m`. 이미지 일괄 변환 금지 |
| Render Free | 15분 유휴 → 슬립 (콜드스타트 30~60초) | cron-job.org로 `/actuator/health` 10분 핑 |
| Render Free | 디스크 임시(ephemeral) | 파일을 로컬에 영구 저장 금지 → 전부 R2 |
| **Neon** | **연결 수 제한** | HikariCP `maximum-pool-size: 3` ← 기본값 10이면 연결 고갈 |
| Cloudflare R2 | 10GB (전송량 무료) | 80% 경고 · **95% 업로드 차단** |

```yaml
# application.yml
spring:
  datasource:
    hikari:
      maximum-pool-size: 3        # ★ Neon 무료 티어
      connection-timeout: 20000
```

---

## 환경 변수 (`application-local.yml` — 커밋 금지)

```
DATABASE_URL / DB_USERNAME / DB_PASSWORD
JWT_SECRET                  # 최소 256bit 랜덤
JWT_ACCESS_TTL=1800         # 30분
JWT_REFRESH_TTL=1209600     # 14일
KAKAO_CLIENT_ID / KAKAO_CLIENT_SECRET / KAKAO_REDIRECT_URI
R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET / R2_ENDPOINT
MAIL_API_KEY / NOTIFY_EMAIL
```

⚠️ `JWT_SECRET`이 노출되면 **누구나 토큰을 위조**할 수 있습니다. 실수로 커밋했다면 즉시 재발급하세요.

---

## 개발용 시드 계정 (`local` 프로필 전용)

가입 → 승인 흐름을 매번 손으로 밟지 않아도 되게, 역할별 계정을 자동으로 만듭니다.
**최초 전도사는 API로 만들 수 없으므로**(역할 변경은 `MEMBER ↔ LEADER`만) 이것이 유일한 방법입니다.

`application-local.yml`에 넣으세요 — 이 파일은 `.gitignore` 대상입니다:

```yaml
app:
  seed:
    enabled: true
    password: <원하는 비밀번호>     # ★ 커밋되는 파일에 쓰지 마세요
```

기동하면 세 계정이 **승인된 상태로** 생깁니다:

| 이메일 | 역할 | 마을 |
|---|---|---|
| `pastor@light.local` | `PASTOR` | 1 |
| `leader@light.local` | `LEADER` | 2 |
| `member@light.local` | `MEMBER` | 3 |

비밀번호는 셋 다 위에서 정한 값입니다. 이미 있으면 다시 만들지 않고, 기존 비밀번호도 덮지 않습니다.

**안전장치 3겹** — 운영에서 돌면 비밀번호를 아는 관리자 계정이 인터넷에 열립니다:

1. `@Profile("local")` — prod·test에서는 빈이 만들어지지 않음
2. `prod` 프로필이 함께 켜져 있으면 **기동 중단** (`local,prod` 같은 실수를 잡음)
3. `enabled` 기본값 `false`, 비밀번호 기본값 없음

⚠️ **배포 전 체크리스트에 "시드 계정 비밀번호 변경 또는 삭제"가 있습니다**
(`ARCHITECTURE.md §13` · `SPEC_NONFUNCTIONAL.md`). 운영 이관 시 반드시 처리하세요.

---

## 로컬 DB

```bash
docker run -d --name light-db -p 5432:5432 \
  -e POSTGRES_PASSWORD=local -e POSTGRES_DB=light postgres:16
```

## 실행

```bash
./gradlew bootRun     # localhost:8080
./gradlew build       # ★ 인가 테스트 포함
```

- Swagger UI: `http://localhost:8080/swagger-ui.html` ← **FE와의 계약서**
- 헬스체크: `http://localhost:8080/actuator/health`

---

## ★ 가장 중요한 3가지

**1. DB 방어선이 없습니다.**
초기 설계는 Supabase + RLS였습니다. 그 구조에서는 코드에서 `where`를 빠뜨려도 DB가 막아줬지만, Spring이 단일 계정으로 접속하는 지금은 **그 방어선이 없습니다.**
→ **인가 테스트 매트릭스**([`../docs/backend/BACKEND_TASKS.md`](../docs/backend/BACKEND_TASKS.md) §6)가 마지막 방어선이며, 기능 코드보다 우선순위가 높습니다.

**2. 게시물 조회는 단일 관문을 통과시킵니다.**
```java
// PostQueryService — 모든 posts 조회가 여기를 통과
public void assertReadable(PostCategory category, Role role) { ... }
```
Controller가 받은 `category`를 그대로 신뢰하지 마세요. 상세 조회는 **id로 먼저 찾고 그 글의 category 권한을 확인**합니다.

**3. 응답 규약을 지킵니다.**
```json
{ "data": { } }
{ "error": { "code": "FORBIDDEN", "message": "...", "field": null } }
```
에러 코드는 7개 집합만: `UNAUTHORIZED · FORBIDDEN · NOT_FOUND · VALIDATION_ERROR · PENDING_APPROVAL · STORAGE_LIMIT · DUPLICATE`
**ID는 문자열로 직렬화**합니다 (JS 정밀도 이슈).

---

## 참고
- **첫날 읽기 순서**: [`../docs/backend/ONBOARDING_BACKEND.md`](../docs/backend/ONBOARDING_BACKEND.md)
- **작업 지시서**: [`../docs/backend/BACKEND_TASKS.md`](../docs/backend/BACKEND_TASKS.md)
- **협업 규칙**: [`../docs/ops/INTEGRATION.md`](../docs/ops/INTEGRATION.md)
- **도구 버전**: [`../docs/ops/TOOLCHAIN.md`](../docs/ops/TOOLCHAIN.md)
- 상세 설계: [`../docs/spec/ARCHITECTURE.md`](../docs/spec/ARCHITECTURE.md)
