# 백엔드 작업 지시서 — LIGHT 홈페이지

- 대상: 백엔드 담당자 (Spring Boot)
- 총 산정: **261h** (학습 계수 ×1.2 적용 시 **313h**) · 4h/일 기준 약 11주
- 이 문서만 읽고도 작업할 수 있게 썼습니다. 더 깊은 배경은 `ARCHITECTURE.md`를 참고하세요.
- 협업·병합 규칙은 **`INTEGRATION.md`** (반드시 먼저 읽어주세요)

---

## 0. 시작 전에 — 이 프로젝트가 무엇인가

김해교회 청년교회(LIGHT) 홈페이지. **성격이 다른 3개 영역**을 한 서비스에 담습니다.

| 영역 | 대상 | 백엔드 관여 |
|---|---|---|
| 공개 | 비로그인 방문자 | 낮음 (공지·새가족 폼만) |
| 회원 | 로그인 청년 | 주보·사진첩·공지 |
| 운영 | 임원·전도사 | 회의록·예산안·**월례회 자료**·회원 관리 |

### 백엔드의 핵심 책임 한 문장
> **"누가 무엇을 볼 수 있는가"를 서버가 정확히 통제한다.**

예산안·회의록·월례회 자료가 일반 회원이나 비로그인 사용자에게 노출되는 것이 이 프로젝트의 **치명적 실패**입니다. 기능이 조금 늦는 것보다 권한이 새는 것이 훨씬 나쁩니다.

### ⚠️ 특히 중요한 배경: DB 방어선이 없다
초기 설계는 Supabase + RLS(PostgreSQL 행 수준 권한)였습니다. 그 구조에서는 코드에서 `where` 조건을 빠뜨려도 **DB가 막아줬습니다.**

Spring이 단일 DB 계정으로 접속하는 지금 구조에서는 **그 방어선이 없습니다.** 코드에서 권한 검사를 빠뜨리면 그대로 유출됩니다.

→ 그래서 **§6의 인가 테스트 매트릭스가 이 프로젝트에서 당신의 가장 중요한 산출물**입니다. 기능 코드보다 우선순위가 높습니다.

---

## 1. 기술 스택 (확정)

| 레이어 | 선택 | 비고 |
|---|---|---|
| 런타임 | **Java 21** (LTS) | |
| 프레임워크 | **Spring Boot 3.x** | |
| 웹 | Spring Web (MVC) | |
| 보안 | **Spring Security 6 + JWT** (`jjwt`) | 직접 구현 |
| 영속성 | **Spring Data JPA** (Hibernate) | |
| 마이그레이션 | **Flyway** | |
| DB | **PostgreSQL — Neon 무료** | §2.2 주의사항 |
| 스토리지 | **Cloudflare R2** (AWS SDK for Java v2, S3 호환) | |
| 문서 변환 | **Apache PDFBox** | 월례회 전용 |
| 검증 | Bean Validation (`@Valid`) | |
| API 문서 | **springdoc-openapi** (Swagger UI) | FE와의 계약서 |
| 메일 | Spring Mail 또는 Resend HTTP | |
| 테스트 | JUnit 5 + MockMvc | |
| 빌드 | Gradle | |
| 배포 | Docker → **Render Free** | §2.1 주의사항 |

**비용은 전부 $0이어야 합니다.** 유료 전환이 필요해지면 진행하지 않고 먼저 상의합니다.

---

## 2. ⚠️ 무료 인프라의 함정 (먼저 알아야 할 것)

시간을 가장 많이 낭비하게 되는 지점들입니다. 미리 알고 시작하세요.

### 2.1 Render Free (백엔드 호스팅)
| 제약 | 대응 |
|---|---|
| 메모리 **512MB** | JVM 옵션 `-Xmx400m`. 이미지 일괄 변환·대용량 스트림 금지 |
| 15분 유휴 시 **슬립** → 콜드스타트 30~60초 | `cron-job.org`(무료)로 10분마다 `/actuator/health` 핑 |
| 750 인스턴스시간/월 | 24시간 가동 = 약 720h → 무료 한도 안에 들어감 |
| 디스크 임시(ephemeral) | 파일을 로컬에 영구 저장하지 말 것. 전부 R2로 |

> 참고: 공개 사이트는 백엔드에 의존하지 않도록 설계했습니다. 백엔드가 슬립이어도 전도용 페이지는 정상입니다. 영향은 회원 영역 첫 진입 지연뿐입니다.

### 2.2 Neon (PostgreSQL 무료)
- ⚠️ **연결 수 제한이 있습니다.** HikariCP `maximum-pool-size: 3` (기본값 10으로 두면 연결 고갈)
  ```yaml
  spring.datasource.hikari:
    maximum-pool-size: 3
    connection-timeout: 20000
  ```
- 유휴 시 자동 정지되나 재개가 빠릅니다. 첫 쿼리가 느릴 수 있음
- 저장 0.5GB — 메타데이터만 넣으므로 충분. **파일 바이너리를 DB에 넣지 마세요**

### 2.3 Cloudflare R2
- 저장 10GB · **전송량 무료**(이게 R2를 고른 이유) · Class A 요청 1M/월
- 버킷은 **완전 비공개**. 모든 접근은 서버가 발급한 presigned URL(10분)로만
- ⚠️ **삭제 시 R2 객체까지 지워야 합니다.** 누락되면 용량이 조용히 새고, 10GB를 넘으면 과금이 시작됩니다

### 2.4 용량 초과 방지 (필수 구현)
비용 $0이 제약이므로 **넘지 않게 막는 장치가 기능보다 우선**입니다.
- `photos.size_bytes` 합계로 사용량 계산 (R2 API를 매번 호출하면 요청 한도 낭비)
- `GET /api/admin/storage` 로 사용량 제공
- **80% 경고 · 95%에서 업로드 거부** (`STORAGE_LIMIT` 에러)

---

## 3. 초기 세팅 (W0, 약 6h)

### 3.1 계정 생성 — 전부 기록해 둘 것
개인 계정으로 시작하되, 나중에 교회 명의로 이관해야 합니다. **어떤 계정을 썼는지 문서로 남겨주세요.**

| 서비스 | 용도 |
|---|---|
| Neon | PostgreSQL |
| Cloudflare | R2 버킷 |
| Render | 백엔드 배포 |
| Kakao Developers | 카카오 로그인 (M2에서) |
| Resend 또는 SMTP | 메일 발송 |

### 3.2 프로젝트 초기화
```
backend/
├─ build.gradle
├─ Dockerfile
└─ src/main/
   ├─ java/kr/light/
   │  ├─ LightApplication.java
   │  ├─ config/       SecurityConfig · JwtConfig · R2Config · OpenApiConfig
   │  ├─ auth/         controller · service · jwt · oauth(kakao) · dto
   │  ├─ member/       entity · repository · service · controller(admin)
   │  ├─ post/         entity · repository · PostQueryService(★) · controller
   │  ├─ bulletin/
   │  ├─ album/ photo/ upload(issue·commit) · download
   │  ├─ meeting/      ★ 월례회 (변환·워터마크·기간검사)
   │  ├─ attachment/
   │  ├─ storage/      R2Client · Presigner · UsageService
   │  ├─ newcomer/
   │  └─ common/       ApiResponse · GlobalExceptionHandler · AuditLogger
   └─ resources/
      ├─ db/migration/ V1__init.sql ...
      ├─ application.yml
      ├─ application-local.yml   ← .gitignore
      └─ application-prod.yml
```

### 3.3 환경 변수
```
SPRING_PROFILES_ACTIVE=local|prod
DATABASE_URL / DB_USERNAME / DB_PASSWORD

JWT_SECRET=                 # 최소 256bit 랜덤
JWT_ACCESS_TTL=1800         # 30분
JWT_REFRESH_TTL=1209600     # 14일

KAKAO_CLIENT_ID= / KAKAO_CLIENT_SECRET= / KAKAO_REDIRECT_URI=

R2_ACCOUNT_ID= / R2_ACCESS_KEY_ID= / R2_SECRET_ACCESS_KEY=
R2_BUCKET= / R2_ENDPOINT=

MAIL_API_KEY= / NOTIFY_EMAIL=
```
⚠️ `application-local.yml`과 `.env`를 **절대 커밋하지 마세요.** `JWT_SECRET`이 노출되면 누구나 토큰을 위조할 수 있습니다.

---

## 4. 데이터 모델 (Flyway V1)

전체 스키마를 M1에 한 번에 만듭니다. 나중에 테이블을 추가하는 것보다 낫습니다.

```sql
member_roster                        -- ★ 교회 등록 명단 (계정과 별개)
  id bigserial PK
  name varchar(50) not null          -- 동명이인 접미사 포함 ("김도연a")
  birth_date date not null
  phone_normalized varchar(20) not null  -- 숫자만 남긴 형태로 저장·비교
  village varchar(16)                -- 출석부(§13)가 씀. 명단 CSV에 없으면 null
  active boolean not null default true
  claimed_at timestamptz             -- 계정을 만든 시각. null이면 미가입
  claimed_by bigint FK members
  created_at timestamptz not null
  UNIQUE (name, birth_date, phone_normalized)
  -- ⚠️ 명단 원본 CSV는 저장소에 커밋하지 않습니다

members
  id bigserial PK
  login_id varchar(30) unique        -- 사용자가 정한 아이디. 카카오 전용은 null
  password_hash varchar(255)         -- BCrypt. 카카오 전용은 null
  kakao_id varchar(64) unique
  name varchar(50) not null          -- 명단에서 복사. 접미사 그대로 유지
  phone varchar(20)
  roster_id bigint FK member_roster  -- 어느 명단 행으로 가입했는지
  role varchar(16) not null          -- MEMBER|LEADER|PASTOR
  created_at timestamptz not null
  CHECK (login_id IS NOT NULL OR kakao_id IS NOT NULL)
  -- ⚠️ email·village·approved_at·approved_by는 v1.3에서 제거 (승인 절차 폐지)

refresh_tokens
  id / member_id FK / token_hash varchar(255) not null   -- ★ 평문 저장 금지
  expires_at / revoked_at

posts                                -- 공지·회의록·예산안 통합
  id / category varchar(20) not null  -- NOTICE_PUBLIC|NOTICE_MEMBER|MINUTES|BUDGET
  title varchar(200) / slug varchar(200) unique
  body text not null                  -- 리치텍스트 JSON
  pinned boolean / author_id FK members
  published_at / created_at / updated_at

attachments                          -- posts·bulletins 공용
  id / post_id FK(null) / bulletin_id FK(null)
  r2_key varchar(500) not null / r2_key_thumb varchar(500)
  filename / content_type / size_bytes bigint / sort_order int
  created_at

bulletins
  id / service_date date not null unique / uploaded_by FK / created_at

albums
  id / title / event_date / cover_photo_id / created_by FK / created_at

photos
  id / album_id FK ON DELETE CASCADE
  r2_key_view varchar(500) not null    -- 2560px, 다운로드 제공
  r2_key_thumb varchar(500) not null   -- 640px, 그리드
  width / height / size_bytes bigint   -- view+thumb 합계 (용량 집계)
  taken_at / sort_order
  status varchar(16) not null          -- PENDING|COMMITTED
  created_at

meeting_docs                         -- ★ 월례회 (§7)
  id / title / meeting_date date
  viewable_from timestamptz not null
  viewable_until timestamptz not null
  page_count int not null
  created_by FK / created_at
  -- 원본(Word/PDF)은 저장하지 않음

meeting_doc_pages
  id / doc_id FK ON DELETE CASCADE / page_no int
  r2_key varchar(500) not null        -- ★ 절대 클라이언트에 노출 금지
  width / height

meeting_doc_views                    -- 열람 로그
  id / doc_id FK / member_id FK / page_no
  viewed_at / ip varchar(45) / user_agent varchar(300)

newcomer_requests
  id / name / phone / gender / age_group / referrer / message
  agreed_at timestamptz not null      -- 개인정보 동의 시각
  created_at

audit_logs
  id / actor_id / action / target / detail / created_at
```

### 4.1 왜 게시판을 한 테이블로 합쳤나
공지·회의록·예산안은 구조가 동일하고 권한만 다릅니다. 테이블 3개면 CRUD가 3벌 생깁니다.

⚠️ **대신 조회에서 category 권한 검사를 빠뜨리면 한 번에 전부 새어나갑니다.** §5의 단일 관문 패턴을 반드시 지켜주세요.

---

## 5. 권한 — 가장 중요한 부분

### 5.1 역할 계층
```
GUEST    비로그인       → 공개 공지, 설교, 새가족 등록
MEMBER   회원           → + 내부 공지, 회의록, 사진첩, 월례회(기간 내)
LEADER   임원           → + 콘텐츠 작성/업로드/삭제, 예산안, 월례회(기간 무관), 출석부
PASTOR   전도사님        → + 계정 삭제·명단 재개방, 역할 부여, 비밀번호 리셋 코드
```
`RoleHierarchy`로 `ROLE_MEMBER < ROLE_LEADER < ROLE_PASTOR` 선언 → `@PreAuthorize("hasRole('LEADER')")` 하나로 상위 역할까지 통과합니다.

**`PASTOR` 전용 권한은 회원 관리뿐입니다.** (예산안은 임원도 허용 — 팀 결정)

> ⚠️ **`PENDING`은 v1.3(2026-08-31)에서 사라졌습니다.** 명단 대조가 본인 확인을
> 대신하므로 승인 절차가 없습니다 — 가입하면 **즉시 `MEMBER`**입니다
> (`SPEC_API §2.2`). `ErrorCode.PENDING_APPROVAL`도 함께 폐기됩니다.

### 5.2 반드시 지킬 3가지 규칙

**① 단일 관문 패턴**
모든 `posts` 조회는 서비스 계층의 한 지점을 통과해야 합니다.
```java
// PostQueryService
public void assertReadable(PostCategory category, Role role) { ... }
```
Controller가 받은 `category`를 그대로 신뢰하지 마세요.

**② 상세 조회는 id → category 순서로**
```java
// ✅ 올바름: id로 찾고, 그 글의 category 권한을 확인
Post post = repo.findById(id).orElseThrow(NotFound::new);
assertReadable(post.getCategory(), currentRole);

// ❌ 위험: category를 파라미터로 받아 필터링 → 우회 가능
repo.findByIdAndCategory(id, requestedCategory);
```

**③ 권한 없으면 404 (403 아님)**
예산안 게시물의 **존재 자체를 숨깁니다.** 목록·상세 모두 동일.
(단 "로그인 안 됨"은 401, "역할 부족"은 상황에 따라 403/404 — §6 매트릭스 참조)

### 5.3 자기 잠금 방지
마지막 `PASTOR`가 자신을 강등·탈퇴하면 아무도 회원을 승인할 수 없습니다.
→ Service에서 `PASTOR` 수가 0이 되는 변경을 거부하세요. (RLS가 없으므로 애플리케이션 검사)

---

## 6. ★ 인가 테스트 매트릭스 (당신의 최우선 산출물)

RLS를 잃었으므로 **이 테스트가 마지막 방어선**입니다. 이것 없이는 시스템이 안전하다고 말할 수 없습니다.

```java
@ParameterizedTest
@MethodSource("authorizationMatrix")
void 인가_매트릭스(String method, String path, Role role, int expectedStatus) { ... }
```

> ### ⚠️ 2026-09-01 갱신 — 표를 `SPEC_API §10` v1.3 값으로 교체했습니다
> **`PENDING` 열이 사라졌습니다.** 명단 대조 가입으로 바뀌며 승인 절차가 폐지되어
> (`SPEC_API §2` v1.3) `PENDING` 역할 자체가 없습니다. `approve` 행도 폐기했습니다.
>
> 그리고 **8/26판의 "열람은 누구나 200" 모델이 부분 철회**됐습니다. 내부공지·회의록·
> 사진첩·월례회 열람은 **`401`(회원 전용)로 돌아왔고**, 회의록만 `LEADER` → `MEMBER`로
> 완화됐습니다.
>
> ⚠️ **8/26판 표대로 테스트를 짜면 회의록·사진첩이 인터넷에 열린 채로 "통과"합니다.**
> 이 표와 `SPEC_API §10`이 어긋나면 **`SPEC_API §10`이 최종 기준**입니다.

역할 약어: `G`=비로그인 · `M`=MEMBER · `L`=LEADER · `T`=PASTOR

| 엔드포인트 | G | M | L | T |
|---|---|---|---|---|
| `POST /api/auth/verify-roster` · `POST /api/auth/register` · `POST /api/auth/password/reset-with-code` | 200 | 200 | 200 | 200 |
| `POST /api/auth/login` · `POST /api/auth/refresh` | 200 | 200 | 200 | 200 |
| `POST /api/auth/logout` | **204** | 204 | 204 | 204 |
| `GET /api/auth/me` | **401** | 200 | 200 | 200 |
| `PATCH /api/auth/me` · `POST /api/auth/password/change` | **401** | 200 | 200 | 200 |
| `DELETE /api/auth/me` | **401** | 204 | 204 | 204 |
| `GET /api/auth/kakao/authorize` · `GET /api/auth/kakao/callback` | **302** | 302 | 302 | 302 |
| `GET /api/posts?category=NOTICE_PUBLIC` | 200 | 200 | 200 | 200 |
| `GET /api/posts?category=NOTICE_MEMBER` | **401** | 200 | 200 | 200 |
| `GET /api/posts?category=MINUTES` | **401** | **200** | 200 | 200 |
| `GET /api/posts?category=BUDGET` | 403 | 403 | 200 | 200 |
| `GET /api/posts/{공개공지id}` | 200 | 200 | 200 | 200 |
| `GET /api/posts/{내부공지·회의록id}` | **401** | **200** | 200 | 200 |
| `GET /api/posts/{예산안id}` | **404** | 404 | 200 | 200 |
| `POST /api/posts` | 401 | 403 | 200 | 200 |
| `GET /api/files/{공개글첨부id}` | 200 | 200 | 200 | 200 |
| `GET /api/files/{내부공지·회의록 첨부id}` | **401** | 200 | 200 | 200 |
| `GET /api/files/{예산안첨부id}` | **404** | 404 | 200 | 200 |
| `GET /api/bulletins/latest` | **401** | 200 | 200 | 200 |
| `GET /api/bulletins` | **401** | 200 | 200 | 200 |
| `GET /api/bulletins/{id}` | **401** | 200 | 200 | 200 |
| `POST /api/bulletins` | 401 | 403 | 200 | 200 |
| `DELETE /api/bulletins/{id}` | 401 | 403 | 204 | 204 |
| `GET /api/albums` | **401** | 200 | 200 | 200 |
| `GET /api/albums/{id}/photos` | **401** | 200 | 200 | 200 |
| `GET /api/photos/{id}/download` | **401** | 200 | 200 | 200 |
| `POST /api/photos/{id}/report` | **401** | 200 | 200 | 200 |
| `POST /api/albums` | 401 | 403 | 201 | 201 |
| `DELETE /api/albums/{id}` | 401 | 403 | 204 | 204 |
| `POST /api/uploads:issue` | 401 | 403 | 200 | 200 |
| `POST /api/uploads:commit` | 401 | 403 | 200 | 200 |
| `DELETE /api/photos/{id}` | 401 | 403 | 200 | 200 |
| `GET /api/meetings` | **401** | 200 | 200 | 200 |
| `GET /api/meetings/{id}/pages/{n}` (기간 내) | **401** | 200 | 200 | 200 |
| `GET /api/meetings/{id}/pages/{n}` (**기간 외**) | 401 | 403 | 200 | 200 |
| `POST /api/meetings` | 401 | 403 | 200 | 200 |
| `GET /api/meetings/{id}/views` | 401 | 403 | 200 | 200 |
| `GET /api/admin/storage` | 401 | 403 | 200 | 200 |
| `GET /api/admin/newcomers` | 401 | 403 | 200 | 200 |
| `GET /api/admin/members` | 401 | 403 | **403** | 200 |
| `DELETE /api/admin/members/{id}` | 401 | 403 | **403** | 200 |
| `PATCH /api/admin/members/{id}/role` | 401 | 403 | **403** | 200 |
| `POST /api/admin/members/{id}/password/reset` | 401 | 403 | **403** | 200 |
| `POST /api/newcomers` | 200 | 200 | 200 | 200 |
| `GET /api/sermons` | 200 | 200 | 200 | 200 |
| `GET /api/sermons/live` | 200 | 200 | 200 | 200 |
| `GET /api/attendance/sessions` (§13) | 401 | 403 | 200 | 200 |
| `POST /api/attendance/sessions` | 401 | 403 | 200 | 200 |
| `GET /api/attendance/sessions/{id}` | 401 | 403 | 200 | 200 |
| `PUT /api/attendance/sessions/{id}/entries` | 401 | 403 | 200 | 200 |
| `DELETE /api/attendance/sessions/{id}` | 401 | 403 | 200 | 200 |

**굵게 표시된 칸이 8/26판에서 바뀐 지점이자, 실제 사고가 나는 지점입니다.**
**엔드포인트를 추가하면 이 표에 행을 추가하세요. 표에 없는 보호 엔드포인트는 미완성으로 봅니다.**

### 이 표에서 틀리기 쉬운 4가지

1. **비공개 열람의 `G`는 `403`이 아니라 `401`입니다.** 내부공지·회의록·사진첩·월례회는
   "로그인하면 볼 수 있는" 콘텐츠입니다 — 익명에게 `403`을 주면 FE가 로그인 유도를
   할 수 없습니다
2. **`403`과 `404`를 섞지 마세요.** 예산안 **상세·첨부**는 `404`(존재를 숨김),
   예산안 **목록**은 `403`(분류의 존재는 이미 공개된 정보)입니다. ⚠️ 예산안은 위 1번의
   예외입니다 — 익명에게도 `401`이 아니라 `403`·`404`입니다
3. **`G`는 `401`, 로그인했지만 미달은 `403`입니다.** 익명은 "로그인하면 될 수도 있다",
   로그인한 일반 회원은 "로그인해도 안 된다" — FE가 이 둘을 다르게 처리합니다
   (로그인 화면 vs 접근 불가 안내). **여기서 `401`과 `403`을 바꿔 쓰면 회원이
   로그인 화면으로 튕깁니다**
4. **월례회 기간 외 `403`은 로그인 여부와 무관합니다.** `LEADER`↑만 통과하고,
   그 우회는 **세션이 있을 때만** 적용됩니다

⚠️ **사진첩이 `M`이 되면서 presigned URL이 새는 경로가 됩니다.** `GET /albums/{id}/photos`가
발급하는 URL 자체에는 인증이 없으므로 **만료를 짧게(10분 이하)** 가져가고, 개별 다운로드는
매 요청마다 세션을 다시 봅니다 (`SPEC_API §6.7`).

---

## 7. ★ 월례회 자료 — 가장 까다로운 기능

2개월마다 열리는 월례회 자료를 **보기 전용**으로 제공하고, 월례회가 끝나면 열람을 차단합니다.

### 7.1 먼저 — 무엇이 불가능한지 알고 시작하세요
**웹에서 스크린샷 차단은 원천적으로 불가능합니다.** 브라우저에 그런 API가 없습니다. (Android 네이티브는 `FLAG_SECURE`로 가능하지만 iOS는 네이티브에서도 불가, 다른 기기로 화면 촬영은 어떤 방법으로도 막을 수 없음)

→ 목표는 **"기술적 차단"이 아니라 "쉬운 유출 차단 + 유출 시 추적"** 입니다.

| 통제 | 강도 | 담당 |
|---|---|---|
| **열람 기간 제한** (서버 검사) | 강함 | BE ★ |
| **다운로드 경로 차단** (파일 URL 미발급) | 강함 | BE ★ |
| **워터마크 burn-in** | **가장 실효적** | BE ★ |
| 저장 제스처 차단 | 약함 (개발자도구로 우회 가능) | FE |
| 열람 로그 | 중간 | BE |

⚠️ **FE의 저장 제스처 차단은 보안이 아닙니다.** 그것을 근거로 "막았다"고 판단하지 마세요.

### 7.2 원본이 Word 문서 — 변환 경로
자료는 Word로 작성되는데, 다운로드 차단·워터마크를 걸려면 **페이지 이미지**가 필요합니다.

**결정: 업로더가 Word에서 「PDF로 저장」 후 PDF를 업로드 → 서버가 PDFBox로 페이지 이미지 변환**

LibreOffice를 서버에 설치해 자동 변환하는 방식은 **채택하지 않았습니다**:
- Docker 이미지 +700MB, 변환 시 메모리 200~400MB 스파이크 → **512MB에서 위험**
- **컨테이너에 한글 폰트가 없으면 `□□□`로 렌더** (이 방식의 가장 흔한 실패)
- PDF 경유는 폰트가 PDF에 임베드되어 오므로 이 문제가 없고, 레이아웃도 Word와 100% 일치

### 7.3 업로드 처리 (동기, 10페이지 내외 확정)
```
POST /api/meetings  (multipart: PDF + 제목 + 열람기간)
  1. 권한 확인 (LEADER 이상)
  2. PDFBox PDFRenderer 로 페이지별 렌더 (장변 2048px ≈ 175dpi)
  3. 페이지마다: WebP 인코딩 → R2 업로드 → 메모리 해제 → 다음 페이지
  4. meeting_doc_pages 행 생성
  5. PDF 원본 폐기 (저장하지 않음)
```
- ✅ **10페이지 내외 → 동기 처리.** 변환 15~30초 예상. 비동기 폴링 불필요
- ⚠️ **페이지를 순차 처리하고 즉시 해제하세요.** 10페이지를 전부 메모리에 담으면 약 150MB → 512MB 환경에서 위험합니다. 순차 처리하면 한 페이지분(약 15MB)으로 유지됩니다
- ⚠️ **PDF 원본을 남기지 마세요.** 남으면 그 자체가 다운로드 가능한 유출 경로입니다
- 변환 실패 처리: 암호 걸린 PDF, 손상 파일 → 명확한 에러 메시지

### 7.4 열람 처리
```
GET /api/meetings/{id}/pages/{no}
  1. 인증·역할 확인 (MEMBER 이상)
  2. LEADER 이상이면 기간 검사 생략
     MEMBER면  now BETWEEN viewable_from AND viewable_until  → 아니면 403
  3. R2에서 원본 페이지 읽기
  4. 워터마크 합성 — 이름 · 연락처 뒷4자리 · 열람시각 · 문서ID
  5. Cache-Control: no-store 로 스트리밍
  6. meeting_doc_views 기록
```
- ⚠️ **presigned URL을 주지 마세요.** 그 URL은 기간이 끝난 뒤에도 만료 전까지 살아있고 공유 가능해집니다. **이 기능에서만은 서버가 직접 스트리밍**합니다
- 워터마크는 **서버에서 이미지에 합성(burn-in)**. CSS 오버레이는 개발자도구로 제거되므로 의미 없습니다
- 이것이 §4.1의 "서버에서 이미지 변환 안 함" 원칙의 예외입니다. 한 번에 한 페이지만 처리하므로 안전합니다

---

## 8. 사진 업로드 — FE와의 최대 접점

파일이 **Spring을 통과하지 않습니다.** 브라우저 → R2 직접 전송. (512MB에서 수백 장 스트림을 받으면 터집니다)

```
FE                                  BE (당신)
──────────────────────────────────  ────────────────────────────────
파일 선택 · 브라우저 리사이즈
  (2560px view / 640px thumb)
POST /api/uploads:issue ──────────▶ 1. 권한 확인 (LEADER)
                                    2. 용량 한도 검사 (95% 시 STORAGE_LIMIT)
                                    3. photos 행 생성 (status=PENDING)
                        ◀────────── 4. presigned PUT URL 2개씩 반환 (15분)
R2로 PUT 직접 전송 (동시 3~4개)
POST /api/uploads:commit ─────────▶ 5. status=COMMITTED, size_bytes 기록
  (20장 배치)           ◀────────── 6. 결과
```

**합의된 사항 (W0에서 확정)**
| 항목 | 결정 |
|---|---|
| presigned URL 유효시간 | **15분**. 200장은 배치로 나눠 재발급 |
| 재시도 | **같은 photoId로 URL 재발급** (고아 방지) |
| commit 단위 | **20장 배치** (200회 호출은 낭비) |
| 미커밋 정리 | `PENDING` 24시간 경과 행 + R2 객체 삭제 배치 |

> **권장: M1 기간 중 2시간을 떼어 "1장 업로드" 프로토타입을 관통시키세요.** M3에서 처음 붙이면 실패했을 때 되돌릴 시간이 없습니다.

---

## 9. API 명세

> 📋 **요청/응답 JSON까지 포함한 전체 명세는 [`SPEC_API.md`](../spec/SPEC_API.md)에 있습니다.**
> 이 절은 요약이며, 구현 시에는 SPEC_API.md를 기준으로 하세요.

계약서는 **Swagger UI**입니다 (`springdoc-openapi`를 M1 초반에 붙여주세요 → `localhost:8080/swagger-ui.html`).

### 9.1 공통 응답 규약 (FE와 합의됨 — 반드시 지킬 것)
```json
{ "data": { } }
{ "error": { "code": "FORBIDDEN", "message": "권한이 없습니다.", "field": null } }
{ "data": { "items": [], "page": 0, "hasNext": true } }
```
- `@RestControllerAdvice`로 예외를 이 형태로 통일
- 에러 `code`는 **FE가 분기에 쓰는 값**이므로 이 집합을 벗어나지 마세요:
  `UNAUTHORIZED · FORBIDDEN · NOT_FOUND · VALIDATION_ERROR · STORAGE_LIMIT · DUPLICATE`
  (+ `INTERNAL_ERROR` — 500 전용, FE는 분기하지 않고 공통 안내만 띄웁니다)
  ⚠️ `PENDING_APPROVAL`은 v1.3에서 폐기됐습니다. `RATE_LIMITED`는 쓰지 않습니다 —
  rate limit 초과·로그인 잠금은 **일반 실패와 같은 `UNAUTHORIZED`**입니다
  (`SPEC_API §2.1 · §2.3`). 구분해서 알려주면 계정 열거에 쓰입니다
- 날짜는 전부 ISO-8601. `LocalDate` → `"2026-08-24"`, 시각은 UTC + `Z`
- ⚠️ **ID는 문자열로 직렬화하세요** (`"123"`). JS `Number` 정밀도 이슈 회피
- 파일 URL은 항상 presigned URL (월례회 제외 — §7.4)

### 9.2 인증 방식
FE가 Next.js `rewrites`로 `/api/**`를 프록시해 **동일 출처**로 만듭니다 → **CORS 설정 불필요**.
- JWT를 **쿠키**로 발급: `HttpOnly; Secure; SameSite=Lax`
- 액세스 30분 / 리프레시 14일 (DB에 **해시** 저장, 회전)
- CSRF: `SameSite=Lax` + `Origin` 헤더 검증
- ⚠️ **localStorage에 JWT를 넣지 마세요.** XSS 한 번에 전부 털립니다

### 9.3 엔드포인트 전체 목록

> ### ⚠️ 2026-08-25 권한 모델 전환 반영본 (2026-08-26 갱신)
> **열람은 로그인 없이 가능**하고, 로그인은 **올리거나 관리하는 사람의 관문**입니다.
> 아래 표의 `GUEST`는 전부 이 전환의 결과입니다. 근거: `handoff/2026-08-25-public-read-model.md`
> · 테스트 기준은 `SPEC_API §10` 인가 매트릭스 (**그 표가 최종 기준입니다**).

**인증**
| Method | Path | 권한 |
|---|---|---|
| POST | `/api/auth/signup` | GUEST |
| POST | `/api/auth/login` | GUEST |
| POST | `/api/auth/refresh` | — |
| POST | `/api/auth/logout` | 로그인 |
| GET | `/api/auth/me` | 로그인 |
| GET | `/api/auth/kakao/authorize` | GUEST |
| GET | `/api/auth/kakao/callback` | GUEST |
| POST | `/api/auth/complete-profile` | 로그인 |
| POST | `/api/auth/password/reset-request` | GUEST |
| POST | `/api/auth/password/reset` | GUEST |

**게시물**
| Method | Path | 권한 |
|---|---|---|
| GET | `/api/posts?category=&page=&size=` | **분류별** — 공지·회의록 `GUEST` / **예산안만 LEADER** |
| GET | `/api/posts/{id}` | **분류별** — 예산안은 권한 없으면 **404**(존재를 숨김) |
| POST / PUT / DELETE | `/api/posts` `/api/posts/{id}` | LEADER |

**주보 · 사진**
| Method | Path | 권한 |
|---|---|---|
| GET | `/api/bulletins?page=` · `/api/bulletins/latest` · `/api/bulletins/{id}` | **MEMBER** (2026-09-04 G→M) |
| POST / DELETE | `/api/bulletins` `/api/bulletins/{id}` | LEADER |
| GET | `/api/albums?page=` | **GUEST** |
| POST / DELETE | `/api/albums` `/api/albums/{id}` | LEADER |
| GET | `/api/albums/{id}/photos?cursor=&size=` | **GUEST** |
| POST | `/api/uploads:issue` · `/api/uploads:commit` | LEADER |
| DELETE | `/api/photos/{id}` | LEADER |
| GET | `/api/photos/{id}/download` | **GUEST** |
| POST | `/api/photos/{id}/report` | **GUEST** — 익명 신고 허용 |
| ~~GET~~ | ~~`/api/albums/{id}/download?ids=` (ZIP)~~ | ❌ **폐기 — 만들지 마세요** |
| GET | `/api/files/{attachmentId}` | 게시물 권한 상속 → **예산안 첨부만 LEADER**(없으면 404) |

**월례회**
| Method | Path | 권한 |
|---|---|---|
| GET | `/api/meetings` | **GUEST** |
| GET | `/api/meetings/{id}` | **GUEST** (기간 외 403) |
| GET | `/api/meetings/{id}/pages/{no}` | **GUEST** (기간 외 403 · 워터마크는 세션 유무로 두 갈래) |
| POST | `/api/meetings` (multipart PDF) | LEADER |
| PATCH | `/api/meetings/{id}/window` | LEADER |
| DELETE | `/api/meetings/{id}` | LEADER |
| GET | `/api/meetings/{id}/views` | LEADER |

**관리 · 공개**
| Method | Path | 권한 |
|---|---|---|
| GET | `/api/admin/members?q=&page=&size=` | PASTOR — ⚠️ `status=` 폐기(전체 목록 하나뿐) |
| DELETE | `/api/admin/members/{id}` | PASTOR — 계정 삭제 + 명단 `claimed_at` 해제 |
| POST | `/api/admin/members/{id}/password/reset` | PASTOR — 리셋 코드 발급 |
| PATCH | `/api/admin/members/{id}/role` | PASTOR |
| GET | `/api/admin/storage` | LEADER |
| GET | `/api/admin/newcomers` | LEADER |
| POST | `/api/newcomers` | GUEST |
| GET | `/api/sermons?page=&size=` | **GUEST** — 🙏 신규(YouTube 프록시, `SPEC_API §9.2`) |

> ⚠️ **`L`(임원)의 월례회 기간 무관 열람은 로그인 세션이 있을 때만입니다.**
> 익명 요청에는 적용되지 않습니다 — 익명은 `status === "OPEN"`인 자료만 볼 수 있습니다.
>
> ⚠️ **인증 엔드포인트가 v1.3에서 전면 교체됐습니다.** 이메일 가입(구 `/auth/signup`) ·
> `complete-profile` · 이메일 비밀번호 재설정은 폐기되고
> `verify-roster` → `register` → `loginId` 로그인 + 리셋 코드로 바뀝니다
> (`SPEC_API §2`). 위 표의 인증 행은 그 기준입니다.

---

## 10. 마일스톤별 작업 체크리스트

시간은 순수 개발 기준입니다. Spring 학습 시간은 별도로 잡으세요 (§12).

### M1 — 기반 구축 (46h) · 약 2주
FE가 공개 사이트를 만드는 동안 기반을 깝니다. **접점이 거의 없어 편한 구간입니다.**

- [ ] **Spring 프로젝트 셋업** (6h) — Gradle, 프로필 분리, Dockerfile
- [ ] **Flyway 전체 스키마 + JPA 엔티티 10개** (12h)
      → DoD: `./gradlew flywayMigrate` 재현 가능, 엔티티 연관관계 매핑 완료
- [ ] **공통 계층** (6h) — `ApiResponse`, `GlobalExceptionHandler`, `AuditLogger`
      → DoD: 모든 예외가 §9.1 형태로 응답
- [ ] **springdoc-openapi 연결** (3h) → DoD: FE가 Swagger UI로 확인 가능
- [ ] **공개 공지 API** (5h) — `GET /api/posts?category=NOTICE_PUBLIC`
- [ ] **새가족 API + 메일 알림** (6h) — `POST /api/newcomers`, 동의 검증, rate limit
- [ ] **Render 배포 관통 + Neon 연결** (8h)
      → DoD: 배포된 URL에서 `/actuator/health` 200, FE 프록시로 호출 성공

**⚠️ M1에 약 46h의 여유가 생깁니다** (FE는 101h 필요). 이 시간을 반드시 아래에 쓰세요:
- [ ] **Spring Security 학습 선행** (~16h) ★ M2의 가장 큰 덩어리를 미리 이해
- [ ] **M2 인증 조기 착수** (~20h) — M1 배포를 기다릴 이유 없음
- [ ] **사진 1장 업로드 프로토타입** (~4h) — 최대 위험 접점 선행 검증

> 이 여유를 놀리면 전체 13주, 쓰면 11주입니다.

### M2 — 인증·회원 (82h) · 약 3주 — **당신이 병목인 구간**

- [ ] **Spring Security 설정 + JWT** (16h) — 발급·검증·필터, 쿠키 방식
      → DoD: 유효/만료/위조 토큰 각각 테스트
- [ ] **`member_roster` 스키마 + CSV 임포트 + 중복/누락 리포트** (8h)
      → DoD: 동명이인 접미사 누락·전화번호 중복이 임포트 시점에 드러남
      → ⚠️ 명단 원본 CSV는 커밋 금지. `local` 프로필 전용, 경로는 환경변수
- [ ] **`verify-roster` + `register`** (12h) — 3필드 대조, 1회용 5분 토큰
      → DoD: 불일치·미등록·이미가입·rate limit 초과가 **전부 같은 401 문구**
      → DoD: 다중 매칭만 `VALIDATION_ERROR`, 비밀번호가 생일·전화번호면 거부
- [ ] **`loginId` 로그인 + 5회 실패 15분 잠금** (6h) — 잠금도 일반 실패와 동일 응답
- [ ] **RoleHierarchy + `@PreAuthorize` 전면 적용** (4h)
- [ ] **카카오 OAuth** (14h) — authorize·callback·계정 연결
      → ⚠️ §11 주의사항 확인
- [ ] **리셋 코드 발급(`§8.4`) + `reset-with-code`(`§2.9`)** (6h) — 1회용 30분, 해시 저장
- [ ] **계정 삭제 + 명단 재개방 · 역할 부여 + 자기잠금 방지 + 감사로그** (10h)
      → DoD: 마지막 PASTOR 강등 시도 → 거부
      → DoD: 삭제하면 명단 `claimed_at`이 풀려 본인이 다시 가입 가능
- [ ] **posts CRUD + PostQueryService 단일 관문 + 페이징** (14h)
      → DoD: §5.2 세 규칙 준수, §6 매트릭스의 posts 행 통과
- [ ] **시드 스크립트** (4h) — MEMBER·LEADER·PASTOR 각 1개 계정 (임의 ID/비번)
      → DoD: `.env.local`에만 기록, 커밋 금지
- [ ] 통합·디버깅 (4h)

### M3 — 사진첩·주보 (60h) · 약 2.5주

- [ ] **R2 클라이언트 + presigned URL** (8h)
- [ ] **`uploads:issue` / `uploads:commit`** (16h) → §8 합의사항 준수
- [ ] **albums CRUD** (6h) → DoD: 삭제 시 R2 객체까지 삭제
- [ ] **사진 목록 커서 페이징** (6h)
- [ ] **사진 개별 다운로드** (4h) — presigned URL 302 리다이렉트
- [ ] **ZIP 스트리밍 다운로드** (10h) — **최대 30장**, 메모리에 담지 말고 스트리밍
- [ ] **bulletins CRUD + attachments** (14h) — 주보는 이미지 N장, `sort_order`
- [ ] **용량 집계·차단 + 미커밋 정리 배치** (10h) → §2.4
- [ ] 통합·디버깅 (6h)

### M4 — 월례회·테스트·마감 (73h) · 약 3주

- [ ] **★ 인가 테스트 매트릭스** (14h) — §6 전항. **최우선**
- [ ] **월례회 PDF→이미지 변환** (10h) — PDFBox, 순차 처리, 원본 폐기, 실패 처리
- [ ] **월례회 기간 검사 + 워터마크 합성 + 스트리밍** (8h) — §7.4
- [ ] **월례회 열람 로그·기간 수정·임원 예외** (4h)
- [ ] **첨부 업로드·서명URL·삭제** (10h)
- [ ] **앨범 아카이브** (6h)
- [ ] 기타 단위·통합 테스트 (10h)
- [ ] **보안 체크리스트 대응** (7h) — §13
- [ ] 운영 문서·관리자 매뉴얼 (4h)

---

## 11. ⚠️ 카카오 로그인 주의사항

**카카오에서 이메일을 받으려면 "비즈 앱" 전환이 필요하고, 사업자등록번호 또는 고유번호증이 있어야 합니다.** 일반 앱 상태로는 닉네임·프로필사진만 받습니다.

→ **이메일을 아예 받지 않도록 설계를 바꿨습니다** (v1.3). `kakao_id`로 식별합니다.

⚠️ **카카오만으로는 가입할 수 없습니다.** 카카오는 이름·생년월일·전화번호를 주지
않으므로 **명단 대조(`verify-roster`)를 건너뛸 수 없습니다.** 카카오는 가입 2단계의
"수단 ②"일 뿐이고, 가입 간소화 효과는 없습니다.

```
카카오 로그인 → kakao_id로 members 조회
  있으면  → JWT 발급 → FE `/my`로 리다이렉트
  없으면  → state로 회수한 registrationToken 검증
              유효  → members 생성 (role=MEMBER) → JWT 발급 → `/my`
              없음·만료 → `/signup?error=kakao` (명단 확인부터 다시)
```
- **`registrationToken`은 `state`에 직접 싣지 않습니다.** `state`는 CSRF 방어값이므로
  랜덤값만 보내고 서버가 `랜덤 → registrationToken` 대응을 짧게 보관합니다
- 카카오 닉네임은 쓰지 않습니다 — **이름은 명단에서 가져옵니다** (접미사 포함)
- Redirect URI에 배포 도메인 + `http://localhost:8080/api/auth/kakao/callback` 둘 다 등록
- ⚠️ 카카오 가입자는 `login_id`·비밀번호가 없어 **카카오 계정을 잃으면 로그인 수단이
  없습니다.** 그때는 전도사가 `DELETE /api/admin/members/{id}`로 지우고 재가입합니다

---

## 12. Spring 학습 로드맵 (권장)

튜토리얼 수준에서 시작하므로, 아래 순서로 미리 훑어두면 일정이 크게 안정됩니다.

| 우선 | 주제 | 왜 |
|---|---|---|
| 1 | **Spring Security 6 + JWT** (필터 체인, `SecurityFilterChain`, `AuthenticationProvider`) | M2 최대 덩어리(16h). 여기서 막히면 전체가 밀림 |
| 2 | **`@PreAuthorize` / RoleHierarchy / MethodSecurity** | 권한의 핵심 |
| 3 | **MockMvc + `@WithMockUser`** | §6 매트릭스 작성에 필수 |
| 4 | JPA 연관관계 · N+1 (`@EntityGraph`, fetch join) | 목록 조회 성능 |
| 5 | `@RestControllerAdvice` 전역 예외 처리 | §9.1 규약 |
| 6 | Flyway 마이그레이션 | |
| 7 | AWS SDK v2 S3 presigned URL | M3 |
| 8 | Apache PDFBox 렌더링 | M4 |

⚠️ Spring Security는 튜토리얼과 실제 요구가 가장 크게 벌어지는 영역입니다. **M1 여유 시간에 예제 프로젝트를 한 번 관통해두세요.**

---

## 13. 배포 전 보안 체크리스트

- [ ] **§6 인가 테스트 매트릭스 전항 통과** ← 최우선
- [ ] `MEMBER` 토큰으로 `/api/posts?category=BUDGET` → 403
- [ ] `MEMBER` 토큰으로 예산안 상세 직접 조회 → 404 (category 우회 불가)
- [ ] `LEADER` 토큰으로 `/api/admin/members` → 403
- [ ] 토큰 없이 회원 API 전부 → 401
- [ ] 만료·위조·다른 서명키 JWT → 401
- [ ] JWT가 `HttpOnly; Secure; SameSite=Lax` 쿠키로만 전달
- [ ] 리프레시 토큰 DB 저장 시 **해시**, 로그아웃 시 폐기
- [ ] **월례회: 기간 종료 후 페이지 요청 → 403**
- [ ] **월례회: 응답에 R2 키·presigned URL 없음** (네트워크 탭 확인)
- [ ] **월례회: 업로드한 PDF 원본이 서버·R2에 남아있지 않음**
- [ ] 월례회: 워터마크에 열람자 정보 정확히 합성 · `Cache-Control: no-store`
- [ ] 월례회: 임원은 기간 종료 후에도 열람 가능
- [ ] R2 버킷 공개 접근 차단, presigned URL 만료 확인
- [ ] 첨부·사진 URL을 로그아웃 상태에서 열기 → 거부
- [ ] 마지막 PASTOR 강등 시도 → 거부
- [ ] **시드 계정 비밀번호 변경 또는 삭제** (운영 이관)
- [ ] 비밀번호 BCrypt, 재설정 링크 1회용·만료
- [ ] R2 사용량 경고·업로드 차단 동작
- [ ] 앨범 삭제 시 R2 객체까지 삭제 (고아 없음)
- [ ] `JWT_SECRET`·R2 키가 저장소에 없음 (`git log -p | grep` 확인)

---

## 14. 막히면

- **1시간 룰**: 혼자 1시간 넘게 막히면 프론트 담당자에게 공유하세요. 하루 4시간 예산에서 1시간 낭비는 상당합니다
- **API 계약을 조용히 바꾸지 마세요.** 변경 시 즉시 공유 — 절차는 `INTEGRATION.md §5`
- 주 2회 동기화에서 다룰 것: 접점 진행 · 막힌 것 · 계약 변경

## 15. 참고 문서
| 문서 | 내용 |
|---|---|
| **`INTEGRATION.md`** | **협업·병합 규칙 — 먼저 읽어주세요** |
| `ARCHITECTURE.md` | 이 문서의 배경·상세 설계 |
| `PLAN.md` | 서비스 기획 (왜 이런 요구인지) |
| `WIREFRAME.md` | 화면 설계 (FE가 무엇을 만드는지) |
| `WORKPLAN.md` | 전체 일정·시간 산정 |
| **`SPEC_API.md`** | **API 명세 — 요청/응답 JSON 포함** |
| `SPEC_FUNCTIONAL.md` | 기능 명세 — 수용 기준 |
| `SPEC_NONFUNCTIONAL.md` | 비기능 명세 — 성능·보안 목표 |
| `CICD.md` | Jenkins CI/CD · 머지 게이트 |
