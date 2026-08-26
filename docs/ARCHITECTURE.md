# 시스템 아키텍처 / 개발 기획서 — LIGHT

- 문서 버전: **v2.4** (월례회 분량 확정 10p → 동기 변환) · **기획 확정본**
- 대상: 김해교회 청년교회 LIGHT 홈페이지 + PWA
- 팀: 2명 (FE 1 · BE 1) · 분업·일정은 `WORKPLAN.md`
- 제약: **월 비용 $0** · 기능 축소 없음 (기간으로 조정 — `WORKPLAN.md §1`)

### 버전 이력
| 버전 | 구성 | 폐기 사유 |
|---|---|---|
| v0.1 | Notion 기반 정적 사이트 | 권한 표현 불가 |
| v1.x | Supabase(DB·Auth·RLS) + Next.js 풀스택 | BE 담당자의 Spring 학습이 목표에 포함 |
| **v2.1** | **Spring Boot REST API + Next.js 클라이언트** · 전체 기능 유지 | 현행 |

---

## 1. 아키텍처 개요

### 1.1 v1.x에서 무엇이 바뀌었는가
백엔드를 Spring Boot로 분리하면서 v1.x 설계의 다음 요소가 **성립하지 않는다.**

| v1.x | v2.0 | 영향 |
|---|---|---|
| Supabase Auth | **Spring Security + JWT** | 인증을 직접 구현. 작업량 증가 |
| **RLS (DB 최후 방어선)** | **소멸** → §5.3으로 보완 | ⚠️ 가장 중요한 변화 |
| Server Action | REST API | 계약 문서(OpenAPI) 필요 |
| Supabase Storage | R2 (AWS SDK for Java) | 동일 |
| 배포 1개 (Vercel) | 배포 2개 (Vercel + BE 호스팅) | §8 — $0 유지가 과제 |

> **RLS 상실이 가장 중요하다.** v1.x에서는 코드에서 권한 검사를 빠뜨려도 DB가 막아줬다.
> Spring이 DB에 단일 계정으로 접속하는 구조에서는 그 방어선이 없다.
> → §5.3 **인가 테스트 매트릭스**가 이를 대체한다. 선택이 아니라 필수다.

### 1.2 전체 구조

```
                    ┌─────────────────────────────────┐
                    │   사용자 (모바일 90%)            │
                    │   브라우저 / PWA 홈 화면 설치     │
                    └────────────────┬────────────────┘
                                     │ HTTPS
                    ┌────────────────▼────────────────┐
                    │      Vercel — Next.js 16        │
                    │                                 │
                    │  [공개 영역]  완전 정적(SSG)     │
                    │   / /about /worship /welcome    │
                    │   → 백엔드 의존 없음 ★           │
                    │                                 │
                    │  [회원·운영]  클라이언트 렌더     │
                    │   /my/* /admin/*  → API 호출     │
                    │                                 │
                    │  next.config rewrites:          │
                    │   /api/** → Spring (동일 출처화)  │
                    └────────────────┬────────────────┘
                                     │ REST + JWT(httpOnly 쿠키)
                    ┌────────────────▼────────────────┐
                    │   Spring Boot 3 (Java 21)       │
                    │                                 │
                    │   Controller → Service → Repo   │
                    │   Spring Security @PreAuthorize │
                    │   JWT 발급·검증 · 카카오 OAuth   │
                    │   R2 presigned URL 발급         │
                    └───────┬─────────────────┬───────┘
                            │ JDBC            │ S3 API
                  ┌─────────▼──────┐  ┌───────▼─────────┐
                  │  PostgreSQL    │  │  Cloudflare R2  │
                  │  (Neon 무료)   │  │  (비공개 버킷)   │
                  │  회원·게시물    │  │  사진·주보·첨부  │
                  │  메타데이터     │  │  10GB·전송 무료  │
                  └────────────────┘  └─────────────────┘
```

### 1.3 핵심 설계 판단
| 판단 | 이유 |
|---|---|
| **공개 영역은 백엔드에 의존하지 않는다** | Spring이 슬립·장애여도 전도용 공개 사이트는 정상 동작 (§8.1과 직결) |
| **Next.js `rewrites`로 API를 동일 출처화** | CORS 설정 불필요, httpOnly 쿠키가 그대로 동작 (§6.3) |
| 공개 공지도 **빌드 시점에 가져와 정적화** | 방문자 트래픽이 백엔드를 깨우지 않게 |
| 권한은 **Controller + Service 이중 검사 + 테스트 매트릭스** | RLS 상실 보완 (§5.3) |
| 원본 대신 **2560px 리사이즈** 보관 | 비용 $0 (§4) |
| 이미지 변환을 **서버에서 하지 않는다** | 무료 호스팅 512MB 메모리 제약 (§4.1) |
| 앱 = **PWA** | 네이티브 API 불필요 |

---

## 2. 기술 스택

### 2.1 프론트엔드
| 레이어 | 선택 |
|---|---|
| 프레임워크 | Next.js 16 (App Router · Turbopack 기본) |
| 언어 | TypeScript (strict) |
| 스타일 | Tailwind CSS v4 |
| 데이터 페칭 | TanStack Query (회원 영역) / 빌드 시 fetch (공개 영역) |
| 폼 | React Hook Form + Zod |
| 폰트 | Pretendard (self-host) |
| PWA | manifest + **자체 서비스워커** (Serwist 미사용 — 캐싱 정책이 보안 요구사항이라 라이브러리 설정 뒤에 두지 않았다. `DECISIONS.md` 2026-08-24) |
| 배포 | Vercel |

### 2.2 백엔드
| 레이어 | 선택 | 비고 |
|---|---|---|
| 런타임 | **Java 21** | LTS |
| 프레임워크 | **Spring Boot 3.x** | |
| 웹 | Spring Web (MVC) | |
| 보안 | **Spring Security 6 + JWT** (`jjwt`) | §5 |
| 영속성 | **Spring Data JPA** (Hibernate) | |
| 마이그레이션 | **Flyway** | 스키마 변경 추적 |
| DB | **PostgreSQL** (Neon 무료) | §8.2 |
| 스토리지 | Cloudflare R2 (**AWS SDK for Java v2**, S3 호환) | |
| 이미지 | 브라우저 리사이즈 (사진) | §4.1 |
| 문서 변환 | **Apache PDFBox** (PDF→페이지 이미지) | 월례회 전용. §7.7 |
| 검증 | Bean Validation (`@Valid`) | |
| API 문서 | **springdoc-openapi** (Swagger UI) | ★ FE와의 계약서 |
| 메일 | Spring Mail 또는 Resend HTTP | |
| 테스트 | JUnit 5 + MockMvc | §5.3 |
| 빌드 | Gradle | |
| 배포 | Docker → §8.1 | |

### 2.3 왜 Next.js인가 — React SPA·Flutter와의 비교
**Next.js는 React다.** 별개 생태계가 아니라 React에 라우팅·SSG/SSR·이미지 최적화를 얹은 프레임워크이며, Node는 **빌드 시점과 Vercel 프록시 계층에서만** 쓰인다. 운영해야 할 Node 서버는 없다.

| 선택 | SEO·공유 미리보기 | 앱 | 코드베이스 | 판단 |
|---|---|---|---|---|
| **Next.js (SSG+CSR)** | ○ 실제 HTML 생성 | PWA | 1개 | ★ 채택 |
| Vite + React SPA | ✕ 초기 HTML 빈 껍데기 | PWA | 1개 | 공개 사이트 목적과 충돌 |
| Flutter Web | ✕ canvas 렌더 → 크롤러가 읽을 텍스트 없음 | 네이티브 | 웹+앱 2개 | 공개 사이트 불가 |

**결정적 근거: 카카오톡 공유 미리보기.**
청년부 홍보 경로는 대부분 카카오톡·인스타그램 링크다. **카카오 크롤러는 JS를 실행하지 않고 HTML의 OG 태그만 읽는다.** SPA는 링크를 붙여도 제목·설명·이미지 미리보기가 나오지 않아 클릭률이 크게 떨어진다. `김해 청년부` 검색 노출도 같은 이유로 불리하다.
→ 공개 영역은 SSG로 실제 HTML을 만들고, 회원 영역은 클라이언트 렌더로 SPA와 동일하게 동작시킨다. **한 코드베이스로 두 요구를 모두 만족**하는 유일한 선택이다.

**Flutter를 지금 쓰지 않는 이유 / 나중에 열려 있는 이유**
- Flutter Web은 SEO가 사실상 불가능 → 공개 사이트의 존재 목적(검색·공유 유입)이 무너진다
- 웹이 필요하므로 Flutter를 쓰면 Dart 앱 + 웹 **두 코드베이스**가 된다. 2인 팀 + BE의 Spring 학습과 병행 불가
- 필요한 앱 기능이 문서 열람·사진 저장뿐이라 네이티브 API가 필요 없다 → PWA로 충분(§8)
- ✅ **다만 백엔드를 REST API로 분리했으므로, 나중에 Flutter 앱을 추가할 때 아키텍처 변경이 필요 없다.** 같은 API를 Flutter 클라이언트가 호출하면 된다 → M5 선택 항목 (추가 120~160h)

> 순서: **웹 우선(SEO 필수) → PWA → 필요 시 Flutter 추가.** 순서를 바꾸면 공개 사이트를 잃는다.

### 2.4 학습 목표와의 정합성
BE 담당자의 Spring Boot 학습이 목표이므로 이 프로젝트는 좋은 연습 과제다. 다루게 되는 주제:
- Spring Security 인증/인가 (JWT, OAuth2 클라이언트)
- JPA 연관관계 매핑, N+1 회피, 페이징
- 계층 분리, DTO 변환, 전역 예외 처리(`@RestControllerAdvice`)
- 외부 스토리지 연동 (S3 API, presigned URL)
- 통합 테스트(MockMvc), 마이그레이션(Flyway)
- 컨테이너 배포

⚠️ 다만 **학습 곡선이 일정에 포함된다.** BE 시간 산정에 숙련도 계수를 반영했다 (`WORKPLAN.md §1.4`).

---

## 3. 데이터 모델

Flyway로 관리. 테이블 구성은 v1.x와 같고 인증 관련 컬럼이 추가된다.

```sql
-- 회원
members
  id                bigserial PK
  email             varchar(255) unique      -- 카카오 전용 계정은 null 가능
  password_hash     varchar(255)             -- BCrypt. 카카오 전용은 null
  kakao_id          varchar(64)  unique      -- 카카오 식별자
  name              varchar(50)  not null    -- 실명
  phone             varchar(20)
  village           varchar(16)              -- '1'~'9' | 'newcomer'
  role              varchar(16)  not null    -- PENDING|MEMBER|LEADER|PASTOR
  approved_at       timestamptz
  approved_by       bigint FK members
  created_at        timestamptz  not null
  -- 제약: email 과 kakao_id 중 최소 하나는 존재

refresh_tokens
  id                bigserial PK
  member_id         bigint FK members
  token_hash        varchar(255) not null    -- ★ 평문 저장 금지
  expires_at        timestamptz  not null
  revoked_at        timestamptz

-- 게시물 (공지 · 회의록 · 예산안 통합)
posts
  id                bigserial PK
  category          varchar(20)  not null    -- NOTICE_PUBLIC|NOTICE_MEMBER|MINUTES|BUDGET
  title             varchar(200) not null
  slug              varchar(200) unique      -- 공개 공지만
  body              text         not null    -- 리치텍스트 JSON (Tiptap)
  pinned            boolean      default false
  author_id         bigint FK members
  published_at      timestamptz
  created_at / updated_at

-- 첨부파일 (posts · bulletins 공용)
attachments
  id                bigserial PK
  post_id           bigint FK posts     (nullable)
  bulletin_id       bigint FK bulletins (nullable)
  r2_key            varchar(500) not null
  r2_key_thumb      varchar(500)             -- 이미지(주보)인 경우
  filename          varchar(255) not null
  content_type      varchar(100)
  size_bytes        bigint       not null
  sort_order        int          default 0   -- 주보 페이지 순서
  created_at        timestamptz

-- 월례회 자료 (열람 제한 — §7.7)
meeting_docs
  id                bigserial PK
  title             varchar(200) not null      -- '2026년 8월 월례회'
  meeting_date      date         not null
  viewable_from     timestamptz  not null      -- 열람 시작
  viewable_until    timestamptz  not null      -- ★ 이후 열람 불가
  page_count        int          not null
  created_by        bigint FK members
  created_at        timestamptz
  -- 원본(Word/PDF)은 저장하지 않는다. 페이지 이미지만 보관

meeting_doc_pages
  id                bigserial PK
  doc_id            bigint FK meeting_docs ON DELETE CASCADE
  page_no           int          not null
  r2_key            varchar(500) not null      -- 원본 페이지 이미지 (비공개)
  width / height    int
  -- ★ 이 키는 절대 클라이언트에 노출되지 않는다. 워터마크 합성 후 스트리밍만

meeting_doc_views                              -- 열람 로그 (추적용)
  id                bigserial PK
  doc_id            bigint FK meeting_docs
  member_id         bigint FK members
  page_no           int
  viewed_at         timestamptz
  ip                varchar(45)
  user_agent        varchar(300)

-- 주보
bulletins
  id                bigserial PK
  service_date      date         not null unique
  uploaded_by       bigint FK members
  created_at        timestamptz

-- 사진 앨범
albums
  id                bigserial PK
  title             varchar(200) not null
  event_date        date
  cover_photo_id    bigint
  created_by        bigint FK members
  created_at        timestamptz

-- 사진 (파일 본체는 R2)
photos
  id                bigserial PK
  album_id          bigint FK albums ON DELETE CASCADE
  r2_key_view       varchar(500) not null    -- 2560px, 다운로드 제공
  r2_key_thumb      varchar(500) not null    -- 640px, 그리드
  width / height    int
  size_bytes        bigint       not null    -- view+thumb 합계 (용량 집계)
  taken_at          timestamptz
  status            varchar(16)  not null    -- PENDING|COMMITTED (§7.3)
  created_at        timestamptz

-- 새가족 등록 (공개 폼)
newcomer_requests
  id / name / phone / gender / age_group / referrer / message
  agreed_at         timestamptz  not null
  created_at        timestamptz

-- 감사 로그 (권한 변경 등)
audit_logs
  id / actor_id / action / target / detail / created_at
```

### 3.1 게시판을 하나의 테이블로 합친 이유
공지·회의록·예산안은 구조가 동일하고 접근 권한만 다르다(회의록·예산안은 권한까지 동일). 테이블 3개면 CRUD가 3벌 생긴다.

⚠️ 대신 **조회 시 category 필터를 빠뜨리면 전부 새어나간다.** RLS가 없는 v2.0에서 이 위험이 더 크다 → §5.2 규칙 + §5.3 테스트로 막는다.

### 3.2 `size_bytes`를 정확히 기록해야 하는 이유
§4.3의 용량 경고·업로드 차단이 이 값의 `SUM`으로 동작한다. R2 API로 매번 실제 용량을 세면 요청 한도를 낭비한다.

---

## 4. 파일 저장 — 비용 $0

| 서비스 | 무료 한도 | 용도 |
|---|---|---|
| **Cloudflare R2** | 저장 10GB · **전송량 무료** · Class A 1M/월 | 사진·주보·첨부 전부 |
| PostgreSQL (Neon) | 0.5GB | 메타데이터 |

전송량 무료가 결정적이다. 사진 다운로드가 핵심 기능이므로 egress 과금이 있는 서비스는 쓸수록 비용이 오른다.

### 4.1 10GB 안에서 버티는 방법 — 원본을 보관하지 않는다
| 전략 | 장당 | 10GB 수용량 |
|---|---|---|
| 원본(5MB) 보관 | 5.15MB | 약 1,900장 (2년) |
| **장변 2560px q85 + 썸네일** ★ | 1.35MB | **약 7,400장 (7년)** |

```
photos/{albumId}/{photoId}/view.webp    2560px q85 (~1.2MB)  다운로드 제공용
photos/{albumId}/{photoId}/thumb.webp    640px q80 (~80KB)   그리드 열람용
```
- **브라우저에서 리사이즈 후 업로드.** 서버에 이미지 변환이 없으므로 Spring의 메모리·CPU를 아낀다 — 무료 호스팅 512MB 제약에서 중요
- 2560px는 휴대폰 감상·SNS 공유·A4 인쇄(약 220dpi)에 충분
- ⚠️ **인쇄·보정용 원본은 이 사이트의 역할이 아니다.** 사역팀이 별도 보관(구글 드라이브·외장하드)하고, 사이트는 감상·공유·저장을 담당한다

### 4.2 주보
이미지 확정. 브라우저에서 2048px WebP 변환 후 업로드. 주당 2장이면 연 약 100MB.

### 4.3 용량 초과 방지 (필수)
무료 한도를 넘기면 과금($0.015/GB·월)이 시작된다. $0이 제약이므로 넘기지 않는 장치가 기능보다 우선한다.
- 관리 화면에 사용량 표시 `4.2GB / 10GB`
- **80% 경고 · 95%에서 업로드 차단** (조용히 과금되는 것보다 낫다)
- 앨범/사진 삭제 시 **R2 객체도 삭제** — 누락되면 용량이 조용히 샌다
- 커밋되지 않은 `PENDING` 사진 정리 배치 (§7.3)

### 4.4 접근 제어
R2 버킷은 완전 비공개. 모든 접근은 Spring이 발급한 **presigned URL(10분)** 로만.

---

## 5. 권한 — RLS 없이 어떻게 지키는가

### 5.1 역할
```
GUEST    비로그인          → 공개 영역
PENDING  가입·미승인        → 대기 화면만
MEMBER   승인된 회원        → + 주보, 사진첩(다운로드), 내부 공지
LEADER   임원              → + 콘텐츠 작성/업로드/삭제, 회의록, 예산안
PASTOR   전도사님           → + 회원 승인, 역할 부여
```
계단식(상위가 하위 포함). Spring Security의 `RoleHierarchy`로 `ROLE_MEMBER < ROLE_LEADER < ROLE_PASTOR`를 선언하면 `@PreAuthorize("hasRole('LEADER')")` 하나로 상위 역할까지 통과한다.

### 5.2 방어 구조 (2층 + 테스트)
| 층 | 수단 | 담당 |
|---|---|---|
| 1. UI | 권한 없는 메뉴 미렌더 | FE — **보안이 아님** |
| 2. **Controller** | `@PreAuthorize` — 모든 보호 엔드포인트 | BE |
| 3. **Service** | 리소스 분류·소유 재검사 | BE |
| — | ~~DB RLS~~ | **없음** |
| 4. **테스트 매트릭스** | 역할 × 엔드포인트 자동 검증 | BE — §5.3 |

**필수 규칙 (BE)**
- 모든 `posts` 조회는 **category 읽기 권한 검사를 서비스 계층에서 강제**한다. Controller가 받은 category를 그대로 신뢰하지 않고, `PostQueryService.assertReadable(category, role)`를 **단일 관문**으로 두고 모든 조회가 이를 통과하게 한다
- 상세 조회(`/posts/{id}`)는 **id로 먼저 찾고 그 글의 category 권한을 확인**한다. category를 쿼리 파라미터로 받아 필터링하는 방식은 우회 가능하다
- 권한 없는 리소스는 **404**를 반환한다(403 아님). 예산안 게시물의 존재 자체를 숨긴다

### 5.3 ⚠️ 인가 테스트 매트릭스 — RLS의 대체물
RLS를 잃었으므로 **자동화된 인가 테스트가 마지막 방어선**이다. BE의 핵심 산출물이며, 이것 없이는 시스템이 안전하다고 말할 수 없다.

```java
@ParameterizedTest
@MethodSource("authorizationMatrix")
void 인가_매트릭스(String method, String path, Role role, int expectedStatus) { ... }
```

| 엔드포인트 | GUEST | PENDING | MEMBER | LEADER | PASTOR |
|---|---|---|---|---|---|
| `GET /api/posts?category=NOTICE_PUBLIC` | 200 | 200 | 200 | 200 | 200 |
| `GET /api/posts?category=NOTICE_MEMBER` | 401 | 403 | 200 | 200 | 200 |
| `GET /api/posts?category=MINUTES` | 401 | 403 | **403** | 200 | 200 |
| `GET /api/posts?category=BUDGET` | 401 | 403 | **403** | 200 | 200 |
| `GET /api/posts/{예산안id}` | 401 | 403 | **404** | 200 | 200 |
| `POST /api/posts` | 401 | 403 | **403** | 200 | 200 |
| `GET /api/bulletins/latest` | 401 | 403 | 200 | 200 | 200 |
| `POST /api/bulletins` | 401 | 403 | **403** | 200 | 200 |
| `GET /api/albums` | 401 | 403 | 200 | 200 | 200 |
| `POST /api/uploads:issue` | 401 | 403 | **403** | 200 | 200 |
| `GET /api/photos/{id}/download` | 401 | 403 | 200 | 200 | 200 |
| `GET /api/admin/members` | 401 | 403 | 403 | **403** | 200 |
| `POST /api/admin/members/{id}/approve` | 401 | 403 | 403 | **403** | 200 |
| `GET /api/meetings/{id}/pages/{n}` (기간 내) | 401 | 403 | 200 | 200 | 200 |
| `GET /api/meetings/{id}/pages/{n}` (**기간 외**) | 401 | 403 | **403** | 200 | 200 |
| `POST /api/meetings` | 401 | 403 | **403** | 200 | 200 |
| `POST /api/newcomers` | 200 | 200 | 200 | 200 | 200 |

- 굵게 표시된 칸이 **실제 사고가 나는 지점**이다
- 엔드포인트를 추가하면 이 표에 행을 추가한다. **표에 없는 보호 엔드포인트는 미완성으로 본다**

### 5.4 자기 잠금 방지
마지막 `PASTOR`가 자신을 강등·탈퇴하면 아무도 회원을 승인할 수 없다. Service에서 `PASTOR` 수가 0이 되는 변경을 거부한다(RLS가 없으므로 애플리케이션 검사).

---

## 6. API 계약

### 6.1 계약 관리 방식
**springdoc-openapi가 생성하는 Swagger UI가 FE와의 계약서다.** 컨트롤러를 만들면 문서가 자동 갱신되므로 별도 문서를 손으로 관리하지 않는다.
- 개발 중: `http://localhost:8080/swagger-ui.html`
- ⚠️ 단 **W0에 시그니처를 먼저 합의**해야 FE가 mock으로 선행 개발할 수 있다 (`WORKPLAN.md §4`)

### 6.2 엔드포인트 목록

**인증**
| Method | Path | 권한 | 설명 |
|---|---|---|---|
| POST | `/api/auth/signup` | GUEST | 이메일 가입 → PENDING |
| POST | `/api/auth/login` | GUEST | JWT 발급(쿠키) |
| POST | `/api/auth/refresh` | — | 액세스 토큰 재발급 |
| POST | `/api/auth/logout` | 로그인 | 리프레시 토큰 폐기 |
| GET | `/api/auth/me` | 로그인 | 내 프로필 |
| GET | `/api/auth/kakao/authorize` | GUEST | 카카오 인가 URL로 리다이렉트 |
| GET | `/api/auth/kakao/callback` | GUEST | 코드 교환 → 계정 생성/로그인 |
| POST | `/api/auth/complete-profile` | 로그인 | 카카오 가입자 실명·연락처·마을 |

**게시물**
| Method | Path | 권한 |
|---|---|---|
| GET | `/api/posts?category=&page=&size=` | 분류별 (§5.3) |
| GET | `/api/posts/{id}` | 분류별 |
| POST | `/api/posts` | LEADER |
| PUT | `/api/posts/{id}` | LEADER |
| DELETE | `/api/posts/{id}` | LEADER |

**주보 · 사진**
| Method | Path | 권한 |
|---|---|---|
| GET | `/api/bulletins?page=` | MEMBER |
| GET | `/api/bulletins/latest` | MEMBER |
| POST | `/api/bulletins` | LEADER |
| DELETE | `/api/bulletins/{id}` | LEADER |
| GET | `/api/albums?page=` | MEMBER |
| POST | `/api/albums` | LEADER |
| DELETE | `/api/albums/{id}` | LEADER |
| GET | `/api/albums/{id}/photos?cursor=&size=` | MEMBER |
| POST | `/api/uploads:issue` | LEADER |
| POST | `/api/uploads:commit` | LEADER |
| DELETE | `/api/photos/{id}` | LEADER |
| GET | `/api/photos/{id}/download` | MEMBER |
| GET | `/api/files/{attachmentId}` | 게시물 권한 상속 |

**월례회 자료 (§7.7)**
| Method | Path | 권한 | 설명 |
|---|---|---|---|
| GET | `/api/meetings` | MEMBER | 목록 (열람 가능/종료 상태 포함) |
| GET | `/api/meetings/{id}` | MEMBER | 메타데이터 (페이지 수·남은 시간). **기간 외 403** |
| GET | `/api/meetings/{id}/pages/{no}` | MEMBER | **워터마크 합성 이미지 스트리밍.** 기간 외 403 |
| POST | `/api/meetings` | LEADER | **PDF 업로드**(multipart) + 열람 기간 설정 → 서버가 페이지 이미지로 변환 |
| PATCH | `/api/meetings/{id}/window` | LEADER | 열람 기간 수정(연장·조기 종료) |
| DELETE | `/api/meetings/{id}` | LEADER | |
| GET | `/api/meetings/{id}/views` | LEADER | 열람 로그 |

**관리 · 공개**
| Method | Path | 권한 |
|---|---|---|
| GET | `/api/admin/members?status=` | PASTOR |
| POST | `/api/admin/members/{id}/approve` | PASTOR |
| POST | `/api/admin/members/{id}/reject` | PASTOR |
| PATCH | `/api/admin/members/{id}/role` | PASTOR |
| GET | `/api/admin/storage` | LEADER |
| GET | `/api/admin/newcomers` | LEADER |
| POST | `/api/newcomers` | GUEST |

### 6.3 인증 방식 — 동일 출처 + httpOnly 쿠키
FE(`vercel.app`)와 BE(`onrender.com`)가 다른 도메인이면 쿠키가 서드파티가 되어 `SameSite=None` 강제, Safari 차단 위험, CSRF 설정 복잡화가 따라온다.

**해결: Next.js `rewrites`로 프록시해 동일 출처로 만든다.**
```ts
// next.config.ts
async rewrites() {
  return [{ source: '/api/:path*', destination: `${process.env.API_ORIGIN}/api/:path*` }];
}
```
- 브라우저는 항상 자기 출처(`https://light.../api/...`)로 요청 → **CORS 설정 불필요**
- 쿠키: `HttpOnly; Secure; SameSite=Lax` — JS가 토큰을 만질 수 없다(XSS로 탈취 불가)
- 액세스 토큰 30분 / 리프레시 14일 (DB에 **해시** 저장, 회전)
- CSRF: `SameSite=Lax` + `Origin` 헤더 검증

> localStorage에 JWT를 넣는 방식은 구현이 쉽지만 XSS 한 번에 전부 털린다. 내부 문서를 다루는 사이트에서는 쓰지 않는다.

### 6.4 공통 응답 규약
```json
{ "data": { } }
{ "error": { "code": "FORBIDDEN", "message": "권한이 없습니다.", "field": null } }
```
- `@RestControllerAdvice`로 예외를 이 형태로 통일 → FE는 에러 처리를 한 곳에서 만든다
- 페이징: `{ "data": { "items": [], "page": 0, "hasNext": true } }`
- 사진 목록만 **커서 페이징** (수백 장 스크롤)

---

## 7. 주요 기능 구현

### 7.1 카카오 로그인
```
FE [카카오로 로그인] → GET /api/auth/kakao/authorize → 카카오 동의
  → 카카오가 /api/auth/kakao/callback?code=... 호출
  → Spring: code → 액세스토큰 → 사용자 정보
  → kakao_id로 members 조회
      있으면 → JWT 발급 → FE 리다이렉트
      없으면 → members 생성(role=PENDING) → JWT 발급
               → FE `/signup/complete` (실명·연락처·마을 입력)
```
⚠️ **착수 전 확인**: 카카오에서 **이메일을 받으려면 "비즈 앱" 전환**이 필요하고 사업자등록번호 또는 고유번호증이 있어야 한다. 일반 앱은 닉네임·프로필사진만 제공.
→ 이메일 없이도 동작하도록 설계했다(`email` nullable, `kakao_id`로 식별). **전환 불가해도 진행 가능.**
→ 카카오 닉네임은 실명이 아닌 경우가 많으므로 **실명은 앱에서 직접 받는다**(승인 대조용).

### 7.2 가입 → 승인
```
가입 → role=PENDING → PASTOR 알림 → /admin/members 승인
  → role=MEMBER, approved_at/by 기록, audit_logs 기록 → 안내 메일
```
`PENDING`은 로그인은 되지만 회원 API가 전부 403 → FE는 `/pending` 화면에 고정.

### 7.3 사진 대량 업로드 (두 팀의 최대 접점)
파일이 **Spring을 통과하지 않는다.** 브라우저 → R2 직접 전송. 무료 호스팅(512MB)에서 파일 스트림을 받으면 메모리가 터진다.

```
FE                                    BE
────────────────────────────────────  ─────────────────────────────
1. 파일 선택(다중)
2. 브라우저 리사이즈 2560/640
3. POST /api/uploads:issue ─────────▶ 용량 한도 검사 (95% 차단)
                                      photos 행 생성 (status=PENDING)
                           ◀───────── presigned PUT URL 2개씩 반환
4. R2로 PUT 직접 전송 (동시 3~4개)
5. POST /api/uploads:commit ────────▶ status=COMMITTED, size_bytes 기록
   (20장 배치)             ◀───────── 결과
6. 진행률 표시 / 실패만 재시도
```
**W0에 합의할 사항**
| 항목 | 결정 |
|---|---|
| presigned URL 유효시간 | 15분. 200장은 배치로 나눠 재발급 |
| 재시도 | **같은 photoId로 URL 재발급** (고아 방지) |
| commit 단위 | **20장 배치** (200회 호출은 낭비) |
| 리사이즈 실패(HEIC 등) | 해당 파일 건너뛰고 목록으로 사용자에게 표시 |
| 미커밋 정리 | `PENDING` 24시간 경과 행 + R2 객체 삭제 배치 |

> **권장: W2에 "1장 업로드" 최소 프로토타입을 먼저 관통시킨다.** 가장 위험한 접점을 마지막에 붙이면 실패했을 때 남은 시간이 없다.

### 7.4 사진 다운로드
| 방식 | 구현 |
|---|---|
| 개별 | `GET /api/photos/{id}/download` → 권한 확인 → presigned URL **302 리다이렉트** |
| 선택(여러 장) ZIP | `GET /api/albums/{id}/download?ids=` → R2에서 스트리밍 읽어 ZIP 파이프. **최대 30장** (§7.4 주의) |

⚠️ **ZIP 스트리밍은 실행시간 제한에 걸릴 수 있다.** Render 무료 인스턴스는 메모리 512MB이므로
전체를 메모리에 담지 않고 **스트리밍으로 파이프**해야 한다. 선택 다운로드는 **최대 30장으로 제한**하고,
그 이상은 나눠 받도록 안내한다.

### 7.5 주보 뷰어
이미지 확정. 스와이프 슬라이드 + 핀치 줌 → **사진첩 라이트박스를 재사용**한다.
⚠️ 주보는 글자가 작다 → 썸네일이 아니라 큰 이미지(2048px)를 바로 로드해야 읽힌다. **사진첩과 로딩 전략이 반대**다.

### 7.7 ⚠️ 월례회 자료 — 열람 제한 (캡처 방지의 현실)

**요구**: 2개월마다 열리는 월례회 자료를 회원이 **보기만** 할 수 있게 하고, 캡처·다운로드를 막고, 월례회가 끝나면 열람도 불가능하게 한다.

#### 먼저 — 무엇이 불가능한가
**웹에서 스크린샷을 차단하는 것은 원천적으로 불가능하다.** 구현 난이도 문제가 아니라 브라우저에 그런 API가 없다.
| 환경 | 스크린샷 차단 |
|---|---|
| 웹 (모든 브라우저) | **불가능** |
| Android 네이티브 앱 | 가능 (`FLAG_SECURE`) |
| iOS 네이티브 앱 | **불가능** (사후 감지만 가능) |
| 어떤 환경이든 | 다른 기기로 화면 촬영은 막을 수 없다 |

→ 따라서 목표를 **"기술적 차단"에서 "쉬운 유출 차단 + 유출 시 추적"** 으로 재정의한다. 이것이 실무에서 유일하게 작동하는 방식이다.

#### 구현하는 통제
| # | 통제 | 강도 | 구현 |
|---|---|---|---|
| 1 | **열람 기간 제한** | **강함** | `viewable_from/until`을 **서버에서** 검사. 기간 외 403. 요구사항의 핵심 |
| 2 | **다운로드 경로 차단** | 강함 | 파일 URL을 발급하지 않는다. presigned URL도 주지 않고 **서버가 이미지를 스트리밍** |
| 3 | **워터마크 burn-in** | **가장 실효적** | 열람자 **이름·전화 뒷4자리·시각**을 이미지에 합성. 캡처해도 누가 유출했는지 드러난다 |
| 4 | 저장 제스처 차단 | 약함 | 우클릭·롱프레스·드래그 차단, `user-select:none`, 투명 오버레이 |
| 5 | 캐시 금지 | 중간 | `Cache-Control: no-store`, `Content-Disposition: inline` |
| 6 | **열람 로그** | 중간 | 누가·언제·몇 페이지를 봤는지 기록 → 유출 시 대조 |
| 7 | 페이지 분할 | 약함 | 페이지 단위로만 제공 (문서 전체를 한 파일로 받을 수 없음) |

**핵심은 3번이다.** 캡처를 막을 수 없으므로, "캡처하면 내 이름이 박힌다"는 사실이 실제 억제력을 만든다. 1·2·3번이 실질 통제이고 4번은 심리적 장벽에 가깝다 — **개발자도구로 우회 가능함을 팀이 인지하고 있어야 한다.** 4번을 근거로 "막았다"고 판단하면 안 된다.

#### ⚠️ 원본이 Word 문서다 — 변환 경로 결정
자료는 **Word(.docx)** 로 작성된다. 그런데 §7.7의 통제(다운로드 차단·워터마크)를 걸려면 **페이지 이미지**가 필요하다. Word를 그대로 브라우저에 보여주면 원본 파일이 클라이언트로 내려가 다운로드를 막을 수 없다.

**변환 방식 비교**

| 방식 | 구현 | 문제 | 판단 |
|---|---|---|---|
| 브라우저에서 docx 렌더 (mammoth.js 등) | 쉬움 | **페이지 나눔·서체·표 레이아웃이 원본과 달라진다.** docx는 페이지 개념이 없다 | ✕ |
| 서버에 **LibreOffice** 설치 → docx→PDF→이미지 | 자동화 | Docker 이미지 +700MB · 변환 시 메모리 200~400MB 스파이크(**Render 512MB 위험**) · **컨테이너에 한글 폰트 미설치 시 □□□ 로 렌더** | △ 위험 |
| ★ **업로더가 Word에서 PDF로 저장 → 서버가 PDF→이미지** | 클릭 1회 추가 | 수동 단계 1개 | ★ **채택** |
| 업로더가 이미지로 직접 내보내기 | — | 페이지 수만큼 수작업 | ✕ |

**결정: 업로더가 Word에서 "PDF로 저장" 후 PDF를 업로드한다.** 서버는 **Apache PDFBox**(순수 Java)로 페이지를 이미지로 렌더한다.

이 선택의 이득:
- LibreOffice·외부 바이너리 불필요 → Docker 이미지 작게, Render 512MB 안에서 안전
- **한글 폰트 문제가 사라진다.** 폰트가 PDF에 임베드되어 오므로 컨테이너에 폰트를 깔 필요가 없다 (LibreOffice 방식의 가장 흔한 실패 원인)
- 레이아웃이 Word 원본과 100% 동일 (PDF가 이미 최종 레이아웃)
- 업로더 부담은 Word의 `다른 이름으로 저장 → PDF` **클릭 1회**

> ❓ 이 수동 단계가 부담이면 M5에서 LibreOffice 자동 변환을 추가할 수 있다. 다만 위 리스크를 감수해야 한다.

#### 변환 파이프라인 (업로드 시 1회)
```
[LEADER] PDF 업로드 (5~10MB)
  → Spring: PDFBox PDFRenderer 로 페이지별 렌더 (장변 2048px ≈ 175dpi)
  → 각 페이지 WebP 인코딩 → R2 비공개 저장 (meeting_doc_pages)
  → PDF 원본은 저장하지 않고 폐기  ★ 원본이 남으면 유출 경로가 된다
  → page_count 기록
```
- ⚠️ **이 업로드는 파일이 Spring을 통과한다.** §4.1의 "서버에서 이미지 변환 안 함" 원칙의 예외다. 사진 대량 업로드(수백 장)와 달리 **문서 1개·수십 페이지**이므로 허용한다. 페이지를 **순차 처리**해 힙 사용을 한 페이지분(약 15MB)으로 유지한다
- ✅ **자료 분량 10페이지 내외 확정** → **동기 처리**(업로드 요청 안에서 변환 완료). 비동기 상태 폴링 불필요
- 10페이지 기준 변환 **15~30초** 예상 → 클라이언트에 진행 상태 표시 필요 (빈 화면 금지)
- 요청 타임아웃 설정: 클라이언트 120초 · Render 프록시 한도 내. 30페이지를 넘는 자료가 생기면 그때 비동기로 전환
- 힙 사용은 **한 페이지분(약 15MB)** 으로 유지 — 페이지를 순차 처리하고 즉시 R2로 올린 뒤 해제한다.
  10페이지를 전부 메모리에 담으면 150MB로 512MB 환경에서 위험해진다
- **PDF 원본은 보관하지 않는다.** 남겨두면 그 자체가 다운로드 가능한 유출 경로가 된다

#### 처리 흐름
```
[LEADER] 업로드
  → 페이지 이미지 N장 + 열람 기간 설정
  → R2 비공개 저장 (r2_key는 클라이언트에 절대 노출 안 됨)

[MEMBER] 열람
  GET /api/meetings/{id}/pages/{no}
    1. 인증·역할 확인 (MEMBER 이상)
    2. now BETWEEN viewable_from AND viewable_until  → 아니면 403
    3. R2에서 원본 페이지 읽기
    4. 워터마크 합성 (이름·전화뒤4자리·열람시각·문서ID)
    5. Cache-Control: no-store 로 스트리밍
    6. meeting_doc_views 기록
```
- **응답은 항상 서버를 거친다.** presigned URL을 주면 그 URL이 기간 후에도 (만료 전까지) 살아있고 공유 가능해진다 → 이 기능에서는 presigned URL을 쓰지 않는다
- ⚠️ **메모리 주의**: §4.1에서 "서버에서 이미지 변환을 하지 않는다"고 했으나, 이 기능만 예외다. 단 **한 번에 한 페이지(2048px, 약 25MB 힙)** 만 처리하므로 Render 512MB 안에서 안전하다. 대량 배치 변환이 아님을 구분할 것
- ✅ **임원(LEADER) 이상은 열람 기간 제약을 받지 않는다** (자료 준비·사후 확인). 확정

#### 기간 종료 후 (확정)
- ✅ 목록에는 **`종료됨` 상태로 남고** 열 수 없다 (존재는 알리되 내용은 차단)
- 자료 자체를 삭제하지 않는다 → 임원이 기간 후에도 열람 가능해야 하므로
- 종료 판정은 **서버에서만** 한다. 프론트에서 날짜를 계산해 숨기는 방식은 우회 가능

#### 정직하게 알려야 할 것
운영진에게 **"캡처를 완전히 막을 수는 없다"** 는 점을 반드시 전달해야 한다. 막았다고 믿고 더 민감한 자료를 올리는 것이 가장 위험한 결과다. 이 기능은 **"실수·무심한 유출을 막고, 고의 유출은 추적한다"** 는 수준임을 문서와 업로드 화면에 명시한다.

### 7.6 구현 범위 — 전체 유지
기능을 자르지 않는다. 대신 **마일스톤 4단계로 나눠 각 단계마다 배포 가능한 상태**로 만든다.
전체 소요는 FE 274h · BE 239h(+학습 곡선)로 산정됐다 → `WORKPLAN.md §1·§11`.

| 마일스톤 | 포함 기능 | 배포 시 가치 |
|---|---|---|
| **M1** | 공개 사이트 전체 · 공개 공지 · 새가족 폼 · 설교 영상 · SEO | 전도·검색 유입 시작. 회원 기능 없이 완결 |
| **M2** | 이메일/카카오 로그인 · 승인 · 비밀번호 재설정 · 회원 관리 · 내부 공지 · 내 정보 | 회원 체계 가동 |
| **M3** | 사진첩(업로드·열람·개별/ZIP 다운로드·무한스크롤) · 주보 · 용량 관리 | 회원 재방문 동기 (실사용 시작) |
| **M4** | 리치텍스트 에디터 · 회의록 · 예산안 · **월례회 자료(열람 제한)** · 앨범 아카이브 · **인가 테스트** · PWA · 접근성·성능 | 운영 기능 완성 |
| M5 | Web Push · (검토) 출석·헌금·스토어 앱 | 이후 |

**순서의 근거: 대체 수단이 없는 것부터.**
공개 사이트와 사진첩은 대체할 방법이 없고, 회의록·예산안은 그동안 카카오톡·구글드라이브로 버틸 수 있다.

⚠️ 단 **인가 테스트 매트릭스(§5.3)는 M4로 미루더라도 내부 문서 기능과 같은 마일스톤에 있어야 한다.**
회의록·예산안을 배포하면서 인가 테스트가 없는 상태는 허용하지 않는다.

## 8. 배포 — $0 유지가 과제

Spring Boot는 상시 실행 프로세스가 필요해서, 서버리스인 Vercel과 달리 무료로 돌리기가 까다롭다. **여기서 비용이 새면 프로젝트 전제가 깨진다.**

### 8.1 백엔드 호스팅
| 옵션 | 무료 | 문제 | 판단 |
|---|---|---|---|
| **Render Free** | 750 인스턴스시간/월 | 15분 유휴 시 슬립 → JVM 콜드스타트 30~60초 | ★ 채택 |
| Oracle Cloud Always Free | 영구 무료 (ARM 4코어/24GB) | 직접 운영(Docker·nginx·인증서) 설정 10h+ | 정식 운영 시 이전 |
| Google Cloud Run | 무료 한도 넉넉 | 카드 등록 필수, 콜드스타트 5~15초 | 대안 |
| Fly.io / Railway | **현재 무료 티어 없음** | 카드 청구 | ✕ |

**결정: Render Free.**
- 750시간 = 31일 → **한 서비스를 24시간 켜두는 것이 무료 한도 안에 들어간다**
- 슬립 방지: `cron-job.org`(무료)로 10분마다 `/actuator/health` 핑 → 콜드스타트 회피
- ⚠️ **공개 사이트가 백엔드에 의존하지 않는 설계(§1.3)가 여기서 값을 한다.** 백엔드가 슬립·장애여도 전도용 공개 페이지는 정상. 영향은 회원 영역 첫 진입 지연뿐
- 메모리 512MB → `-Xmx400m`. 서버에서 이미지 변환을 하지 않는 이유(§4.1)

### 8.2 데이터베이스
**Neon 무료** (PostgreSQL 0.5GB). 유휴 시 자동 정지되나 재개가 빠르다.
- ⚠️ 무료 티어는 **연결 수 제한**이 있다 → HikariCP `maximum-pool-size: 3~5`. 기본값(10)이면 연결 고갈이 난다
- 대안: Supabase Postgres (500MB, 단 7일 무활동 시 프로젝트 일시정지)

### 8.3 환경별 구성
| 환경 | FE | BE | DB |
|---|---|---|---|
| 로컬 | `localhost:3000` | `localhost:8080` | Docker Postgres |
| 운영 | Vercel | Render | Neon |

`application-local.yml` / `application-prod.yml` 분리. FE는 `API_ORIGIN`으로 프록시 대상 전환.

---

## 9. 환경 변수

### 프론트엔드 (Vercel)
```
API_ORIGIN=https://light-api.onrender.com   # 서버 전용, rewrites 대상
NEXT_PUBLIC_SITE_URL=https://...
```
⚠️ `API_ORIGIN`에 `NEXT_PUBLIC_`을 붙이지 않는다. 프록시는 서버에서만 이뤄진다.

### 백엔드 (Render)
```
SPRING_PROFILES_ACTIVE=prod
DATABASE_URL / DB_USERNAME / DB_PASSWORD

JWT_SECRET=                 # 최소 256bit 랜덤
JWT_ACCESS_TTL=1800
JWT_REFRESH_TTL=1209600

KAKAO_CLIENT_ID=
KAKAO_CLIENT_SECRET=
KAKAO_REDIRECT_URI=

R2_ACCOUNT_ID=  R2_ACCESS_KEY_ID=  R2_SECRET_ACCESS_KEY=
R2_BUCKET=      R2_ENDPOINT=

MAIL_API_KEY=  NOTIFY_EMAIL=
```
- `JWT_SECRET`·R2 키를 저장소에 커밋하지 않는다. `.gitignore`에 `application-local.yml` 포함
- 모든 계정은 **교회 명의**로 개설 (PLAN §6.5)

---

## 10. 프로젝트 구조

### 10.1 저장소 전략
**모노레포 1개.** 저장소 2개는 2인 팀에서 이슈·PR이 흩어져 관리 비용만 늘어난다.
```
light-homepage/
├─ frontend/     # Next.js      (FE 소유)
├─ backend/      # Spring Boot  (BE 소유)
├─ docs/         # PLAN·WIREFRAME·ARCHITECTURE·WORKPLAN
└─ README.md
```
→ 디렉터리로 소유권이 분리되므로 파일 충돌이 구조적으로 발생하지 않는다.

### 10.2 프론트엔드
```
frontend/src/
├─ app/
│  ├─ (public)/       # HOME, about, worship, welcome, location, notices
│  ├─ (auth)/         # login, signup, signup/complete, pending
│  ├─ my/             # 회원 영역
│  ├─ admin/          # 운영 영역
│  └─ manifest.ts · sitemap.ts · robots.ts
├─ components/  layout/ ui/ home/ photos/ · Logo.tsx
├─ lib/
│  ├─ api/            # index.ts(진입) · mock.ts · real.ts  ← WORKPLAN §4.3
│  ├─ auth.ts         # 세션 상태·역할 판별
│  └─ image.ts        # 브라우저 리사이즈
├─ content/           # site.ts, faq.ts
└─ types/             # 🤝 API 타입 — BE와 합의
```

### 10.3 백엔드
```
backend/src/main/java/kr/light/
├─ LightApplication.java
├─ config/       SecurityConfig · JwtConfig · R2Config · OpenApiConfig
├─ auth/         controller · service · jwt · oauth(kakao) · dto
├─ member/       entity · repository · service · controller(admin)
├─ post/         entity · repository · PostQueryService(★단일 관문) · controller
├─ bulletin/
├─ album/ photo/ upload(issue·commit) · download
├─ attachment/
├─ storage/      R2Client · Presigner · UsageService
├─ newcomer/
├─ common/       ApiResponse · GlobalExceptionHandler · AuditLogger
└─ resources/
   ├─ db/migration/  V1__init.sql ...   (Flyway)
   └─ application*.yml
```

---

## 11. 디자인 토큰
```
색상
  --navy-900 #0B1220  배경(다크)   --navy-800 #131C2E  카드
  --navy-100 #E8ECF3  밝은 배경     --yellow   #FFC940  포인트/CTA
  --gray-400 #8B94A6  보조 텍스트   --red-500  #E5484D  삭제·경고

타이포 (모바일/데스크톱)
  display 32/56 bold · h1 26/36 bold · h2 20/24 bold
  body 16/16 (line-height 1.7) · caption 14/14

간격 4px 배수 · 섹션 여백 64/96 · 라운드 8px(카드)/999px(버튼)
컨테이너 max-w 1200px · padding 20/40
```
- 공개 영역과 회원/운영 영역은 **의도적으로 다르게** 보이게 한다(사진 중심 vs 정보 밀도). 같아 보이면 로그인 상태를 인지하지 못한다
- 접근성: 명도 대비 4.5:1 · 모든 이미지 `alt` · 터치 타겟 44px · 삭제는 확인 모달

---

## 12. SEO / 성능

### SEO (공개 영역만)
- 페이지별 `metadata`, `opengraph-image.tsx`
- `sitemap.ts`는 공개 경로만. `robots.ts`에서 `/my` `/admin` `/api` disallow
- JSON-LD: `Church` + `Event`(주일예배)
- 타깃 키워드: `김해교회 청년부`, `김해 청년교회`, `김해 청년부 예배`

### 성능
| 지표 | 공개 | 회원 |
|---|---|---|
| LCP | < 2.5s | < 3.0s |
| 초기 JS | < 120KB gz | < 180KB gz |

- 공개 영역은 완전 정적 → 백엔드 지연과 무관
- 사진 그리드는 페이지네이션(`더 보기`). 200장 동시 DOM 금지
- 회원 영역 첫 진입 시 백엔드 웨이크업 가능 → **로딩 상태를 반드시 표시**(빈 화면 금지)

---

## 13. 보안 체크리스트 (배포 전 필수)
- [ ] **§5.3 인가 테스트 매트릭스 전항 통과** ← RLS 대체물. 최우선
- [ ] `MEMBER` 토큰으로 `/api/posts?category=BUDGET` → 403
- [ ] `MEMBER` 토큰으로 예산안 상세 직접 조회 → 404 (category 우회 불가)
- [ ] `LEADER` 토큰으로 `/api/admin/members` → 403
- [ ] 토큰 없이 회원 API 전부 → 401
- [ ] 만료·위조·다른 서명키 JWT → 401
- [ ] JWT가 `HttpOnly; Secure; SameSite=Lax` 쿠키로만 전달됨
- [ ] 리프레시 토큰 DB 저장 시 **해시**, 로그아웃 시 폐기
- [ ] R2 버킷 공개 접근 차단, presigned URL 만료 확인
- [ ] 첨부·사진 URL을 로그아웃 상태에서 열기 → 거부
- [ ] `/my` `/admin` 응답에 `noindex`
- [ ] 마지막 PASTOR 강등 시도 → 거부
- [ ] 시드 계정 비밀번호 변경 또는 삭제 (운영 이관)
- [ ] 비밀번호 BCrypt 저장, 재설정 링크 1회용·만료
- [ ] 개인정보 처리방침 게시, 동의 없는 폼 제출 거부
- [ ] R2 사용량 경고·업로드 차단 동작
- [ ] 앨범 삭제 시 R2 객체까지 삭제 (고아 없음)
- [ ] **월례회: 열람 기간 종료 후 페이지 요청 → 403** (시각 조작 테스트 포함)
- [ ] **월례회: 응답에 R2 키·presigned URL이 포함되지 않음** (네트워크 탭 확인)
- [ ] **월례회: 업로드한 PDF 원본이 서버·R2에 남아있지 않음**
- [ ] 월례회: 임원 계정은 기간 종료 후에도 열람 가능
- [ ] **월례회: 워터마크에 열람자 정보가 정확히 합성됨**
- [ ] 월례회: `Cache-Control: no-store` 적용, 뒤로가기 시 재인증
- [ ] `JWT_SECRET`·R2 키가 저장소·클라이언트 번들에 없음

---

## 14. 결정 사항
| # | 항목 | 결정 |
|---|---|---|
| 1 | 백엔드 | **Spring Boot 3 / Java 21** (BE 학습 목표) |
| 2 | 프론트엔드 | Next.js 16 — 공개 영역 정적, 회원 영역 클라이언트 렌더 |
| 3 | 저장소 | 모노레포 1개 (`frontend/` `backend/` `docs/`) |
| 4 | 인증 | JWT + httpOnly 쿠키, Next.js rewrites로 동일 출처화 |
| 5 | 권한 | `@PreAuthorize` + Service 재검사 + **인가 테스트 매트릭스** |
| 6 | DB | PostgreSQL (Neon 무료) · Flyway |
| 7 | 파일 | Cloudflare R2, 브라우저 리사이즈 2560px, 원본 미보관 |
| 8 | 배포 | FE Vercel · BE Render Free (+ 헬스체크 핑) |
| 9 | 비용 | **$0** — 초과 시 진행하지 않음 |
| 10 | 초기 계정 | 임의 ID/비번 시드 (MEMBER·LEADER·PASTOR 각 1) → 운영 시 이관 |
| 11 | 구현 범위 | **전체 기능 유지.** 마일스톤 4단계로 분할 배포 (§7.6) |
| 12 | 앱 | PWA (manifest + 설치). 스토어 배포 없음 |
| 13 | 프론트엔드 선택 | **Next.js 유지** — 카카오톡 공유 미리보기·SEO 때문 (§2.3). Flutter는 M5 선택 항목 |
| 14 | 월례회 자료 | 열람 기간 제한 + 워터마크 + 스트리밍 (§7.7). **캡처 완전 차단은 불가능** |
| 15 | 월례회 변환 | 원본 Word → **업로더가 PDF로 저장** → 서버가 PDFBox로 페이지 이미지 변환. LibreOffice 미사용 |
| 16 | 월례회 권한 | 임원 이상은 **기간 제약 없이** 열람 · 종료 후 목록에 `종료됨`으로 남김 |
| 17 | 월례회 분량 | **10페이지 내외** → 동기 변환 (비동기 폴링 불필요) |

### 남은 확인 항목 — 모두 기본값으로 진행 가능
설계를 막는 항목은 없다. 아래는 개발 중 병행 확인하면 된다.

| # | 항목 | 미결정 시 기본값 | 필요 시점 |
|---|---|---|---|
| 1 | 카카오 비즈 앱 전환 가능 여부 (고유번호증) | 일반 앱 + 앱 내 정보 입력 | M2 |
| 2 | 예산안 **작성**도 임원 허용? | 허용 | M4 |
| 3 | 도메인 (독립 vs gloria.or.kr 서브도메인) | Vercel 기본 도메인 | M1 배포 |
| 4 | 개인정보 보유기간 | 새가족 1년 / 회원 탈퇴 시 즉시 | M1 |
| 5 | 드림센터 길찾기 사진 3장 | 플레이스홀더 | M1 (콘텐츠) |

