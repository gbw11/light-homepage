# 협업 · 병합 규칙 — LIGHT 홈페이지

- 대상: **프론트엔드 · 백엔드 담당자 공통 (양쪽 모두 필독)**
- 목적: 각자 따로 작업하고도 **나중에 합칠 때 문제가 없게** 하는 것
- 관련: `WORKPLAN.md`(일정) · `BACKEND_TASKS.md`(BE 작업) · `ARCHITECTURE.md`(설계)

---

## 1. 2인 프로젝트가 실패하는 3가지 방식

이 문서는 아래 세 가지를 막기 위해 존재합니다.

| # | 실패 방식 | 이 문서의 대응 |
|---|---|---|
| 1 | **같은 파일을 동시에 고쳐 충돌** | §2 디렉터리 소유권 — 물리적으로 겹치지 않게 |
| 2 | **서로를 기다려 병렬 인원인데 순차 속도** | §4 mock 계층 — BE 없이도 FE가 완성 |
| 3 | **각자 다 만들었는데 안 붙음** | §3 API 계약 + §5 변경 절차 + §7 통합 체크포인트 |

**3번이 가장 위험합니다.** FE와 BE가 다른 언어라 타입이 자동으로 공유되지 않기 때문입니다. Java의 `record`와 TypeScript의 `type`은 서로를 모릅니다.

---

## 2. 저장소 구조와 소유권

### 2.1 모노레포 1개
```
light-homepage/
├─ frontend/          Next.js       ← FE 단독 소유
├─ backend/           Spring Boot   ← BE 단독 소유
├─ docs/              계획 문서       ← 공동
│  ├─ PLAN.md
│  ├─ WIREFRAME.md
│  ├─ ARCHITECTURE.md
│  ├─ WORKPLAN.md
│  ├─ BACKEND_TASKS.md
│  └─ INTEGRATION.md   (이 문서)
├─ .github/
│  ├─ workflows/       CI
│  └─ pull_request_template.md
├─ .gitignore
└─ README.md
```

**저장소를 2개로 쪼개지 않는 이유**: 2인 팀에서 이슈·PR·문서가 두 곳으로 흩어지면 관리 비용만 늘어납니다. 디렉터리로 나누면 소유권은 그대로 분리됩니다.

### 2.2 소유권 규칙
| 경로 | 소유 | 규칙 |
|---|---|---|
| `frontend/**` | **FE** | BE는 수정하지 않음 |
| `backend/**` | **BE** | FE는 수정하지 않음 |
| `docs/**` | 공동 | 수정 시 상대에게 알림 |
| `.github/**`, 루트 설정 | 공동 | 변경 시 PR + 상대 승인 |

> **이게 이 구조의 최대 이점입니다.** 언어가 달라 파일이 물리적으로 겹치지 않으므로, 머지 충돌이 구조적으로 발생하지 않습니다. 대신 **접점이 API 하나로 집중**되므로 §3이 그만큼 중요합니다.

### 2.3 초기 세팅 체크리스트
- [ ] GitHub 저장소 생성 (private)
- [x] ~~`main` 브랜치 보호 설정~~ → ⚠️ **무료 Private 저장소에서는 불가** (GitHub Pro 필요). §6.5 규칙으로 대체
- [x] `develop` 브랜치 생성
- [x] 통합 브랜치 3개 생성: `frontend_develop` · `backend_develop` · `server_develop`
- [ ] GitHub 설정에서 **PR 머지 시 브랜치 자동 삭제** 켜기 (Settings → General → Automatically delete head branches)
- [ ] 루트 `.gitignore` 작성 (§2.4)
- [ ] `README.md` — 실행 방법 2줄 (FE/BE 각각)
- [ ] PR 템플릿 추가 (§6.3)
- [ ] 두 사람 모두 collaborator 등록

### 2.4 `.gitignore` (루트)
```gitignore
# ── 공통
.DS_Store
*.log
.env
.env.local
.env.*.local

# ── frontend
frontend/node_modules/
frontend/.next/
frontend/out/
frontend/.vercel/
frontend/next-env.d.ts

# ── backend
backend/build/
backend/.gradle/
backend/bin/
backend/out/
backend/src/main/resources/application-local.yml   # ★ 시크릿
backend/src/main/resources/application-secret.yml

# ── IDE
.idea/
.vscode/
*.iml
```

⚠️ **커밋 전 반드시 확인**: `JWT_SECRET`, R2 키, DB 비밀번호, 시드 계정 비밀번호가 들어가면 안 됩니다.
한 번 커밋되면 히스토리에서 지우기 어렵습니다. 실수했다면 **즉시 키를 재발급**하세요 (커밋만 되돌려도 히스토리에 남습니다).

---

## 3. ★ API 계약 — 이 문서의 핵심

FE와 BE의 유일한 접점입니다. 여기가 맞으면 나머지는 거의 자동으로 맞습니다.

### 3.1 계약의 구성
| # | 산출물 | 위치 | 담당 |
|---|---|---|---|
| 1 | **엔드포인트 + 요청/응답 형태** | **`SPEC_API.md`** ← 계약서 본문 | 공동 확정 |
| 2 | 요청/응답 JSON 형태 | **Swagger UI** (실시간) | BE 구현 |
| 3 | 공통 응답·에러 규약 | 아래 §3.2 | 공동 확정 |
| 4 | FE 타입 정의 | `frontend/src/types/api.ts` | FE 작성 |

### 3.2 공통 규약 (양쪽 모두 준수)
```json
// 성공
{ "data": { } }

// 실패
{ "error": { "code": "FORBIDDEN", "message": "권한이 없습니다.", "field": null } }

// 페이징
{ "data": { "items": [], "page": 0, "hasNext": true } }
```

**에러 코드 집합 — 이 밖의 값을 쓰지 않습니다** (FE가 분기에 사용)
```
UNAUTHORIZED       로그인 필요 (401)
FORBIDDEN          권한 부족 (403)
NOT_FOUND          없음 또는 권한 없어 숨김 (404)
VALIDATION_ERROR   입력값 오류 (400) — field에 필드명
PENDING_APPROVAL   승인 대기 상태 (403)
STORAGE_LIMIT      저장 용량 초과 (409)
DUPLICATE          중복 (409)
```

**직렬화 규칙**
| 항목 | 규칙 | 이유 |
|---|---|---|
| ID | **문자열** (`"123"`) | JS `Number` 정밀도 이슈 회피 |
| 날짜 (`LocalDate`) | `"2026-08-24"` | |
| 시각 | ISO-8601 UTC + `Z` | 타임존 혼란 방지 |
| 파일 URL | presigned URL (월례회 제외) | FE는 R2 경로를 모름 |
| null | 필드를 생략하지 말고 `null` 명시 | FE의 옵셔널 처리 단순화 |

### 3.3 Swagger UI = 살아있는 계약서
BE가 M1 초반에 `springdoc-openapi`를 붙입니다.
- FE는 `http://localhost:8080/swagger-ui.html`에서 실제 형태를 확인
- ⚠️ **Swagger는 구현 후에 생기므로 사전 합의를 대체하지 못합니다.** W0에 §3.1의 1·3번을 먼저 못 박아야 FE가 mock으로 선행 개발할 수 있습니다

---

## 4. FE가 BE를 기다리지 않는 장치 — mock 계층

### 4.1 구조
```
frontend/src/lib/api/
├─ index.ts    # ★ FE는 항상 이것만 import
├─ mock.ts     # 계약에 맞는 가짜 응답 + 지연 300ms
└─ real.ts     # 실제 fetch
```
```ts
// index.ts
export const api = process.env.NEXT_PUBLIC_USE_MOCK === '1' ? mockApi : realApi;
```

### 4.2 규칙
- **FE는 `real.ts`를 직접 import하지 않습니다.** 이 규칙 하나로 병렬 작업이 가능해집니다
- **mock에 실패 케이스를 반드시 넣습니다**: `401` · `403` · `STORAGE_LIMIT` · 업로드 실패 · 빈 목록 · 로딩 지연
  → 성공 경로만 만들면 통합 때 무너집니다
- BE 구현이 끝난 엔드포인트는 `NEXT_PUBLIC_USE_MOCK=0`으로 실연동 확인

### 4.3 BE 쪽 대응
- **엔드포인트를 하나 완성하면 즉시 알립니다.** FE가 mock에서 real로 전환할 수 있게
- Swagger에 예시 응답(`@Schema(example=...)`)을 넣어주면 FE의 mock 정확도가 올라갑니다

---

## 5. ★ 계약 변경 절차 (가장 사고가 잦은 지점)

**API 계약을 조용히 바꾸는 것이 이 프로젝트에서 가장 위험한 행동입니다.** 상대의 작업이 통째로 어긋나고, 발견은 통합 시점에 됩니다.

### 5.1 변경 유형별 절차
| 유형 | 예 | 절차 |
|---|---|---|
| **호환 (추가)** | 응답에 필드 추가, 새 엔드포인트 | 알림만. 상대 작업 무영향 |
| **비호환 (변경/삭제)** | 필드명 변경, 타입 변경, 경로 변경, 에러코드 변경 | **반드시 사전 합의** |

### 5.2 비호환 변경 절차
```
1. 변경이 필요하다고 판단 → 즉시 상대에게 공유 (메시지 1줄이라도)
2. 합의 → docs/ARCHITECTURE.md §6.2 또는 BACKEND_TASKS.md §9.3 수정
3. PR 제목에 [CONTRACT] 태그 → 상대 승인 필수
4. 양쪽이 각자 코드 수정
```

### 5.3 절대 하지 말 것
- ❌ 필드명을 "더 나은 이름"으로 조용히 바꾸기
- ❌ 에러 코드를 §3.2 집합 밖의 값으로 추가하기
- ❌ ID를 숫자로 직렬화하기 (문자열 규칙 위반)
- ❌ 상대가 쓰고 있는 엔드포인트 경로 변경

> **원칙: 계약은 코드보다 비싸다.** 코드는 혼자 고치면 되지만 계약은 두 사람이 고쳐야 합니다.

---

## 6. Git 규칙

### 6.1 브랜치 구조 — 4단 계층

```
main                    배포 (마일스톤 릴리스만)
└─ develop              전체 통합 — 3개 영역이 합쳐지는 지점
   ├─ frontend_develop  프론트엔드 통합
   │   └─ feat/fe-*         ← 실제 작업은 여기서
   ├─ backend_develop   백엔드(Spring 애플리케이션) 통합
   │   └─ feat/be-*         ← 실제 작업은 여기서
   └─ server_develop    서버·인프라·배포 통합
       └─ feat/infra-*      ← 실제 작업은 여기서
```

### 6.2 ★ 작업 규칙 — 통합 브랜치에서 직접 작업하지 않는다

> **`frontend_develop` · `backend_develop` · `server_develop`에 직접 커밋하지 않습니다.**
> 반드시 **하위 브랜치를 한 번 더 만들어서** 작업하고, PR로 올립니다.

```bash
# ✅ 올바른 절차 (프론트엔드 예시)
git checkout frontend_develop
git pull origin frontend_develop          # 최신화 먼저
git checkout -b feat/fe-welcome-page      # 하위 브랜치 생성
# ... 작업 ...
git push -u origin feat/fe-welcome-page
# → GitHub에서 PR: feat/fe-welcome-page → frontend_develop

# ❌ 하지 않는 것
git checkout frontend_develop
# ... 여기서 바로 작업 후 커밋 ...   ← 금지
```

**왜 한 단계를 더 두는가**
- 작업 단위가 PR로 남아 **나중에 "이 기능이 왜 이렇게 됐는지" 추적**할 수 있다
- 작업 중간 상태가 통합 브랜치를 오염시키지 않는다 → 언제든 통합 브랜치는 동작하는 상태
- 되돌리기가 쉽다. 기능 하나를 revert할 때 PR 하나만 되돌리면 된다
- 셀프 머지를 허용하더라도(§6.5) **PR 단위 기록은 남는다**

### 6.3 영역 구분 — 무엇이 어디로 가는가

| 통합 브랜치 | 담당 | 다루는 것 | 주 경로 |
|---|---|---|---|
| **`frontend_develop`** | FE | 화면·컴포넌트·라우팅·PWA·SEO·mock 계층 | `frontend/**` |
| **`backend_develop`** | BE | API·엔티티·인증·인가·비즈니스 로직·테스트 | `backend/src/**` |
| **`server_develop`** | BE(주) | Docker·Render·Neon·R2 설정·CI·환경변수·배포 스크립트·운영 문서 | `.github/**`, `backend/Dockerfile`, 인프라 설정 |

> ✅ **`server_develop` = 서버 배포·인프라 담당** (2026-08-20 확정)
> 2인 팀이므로 실제로는 BE 담당자가 `backend_develop`과 `server_develop`을 함께 씁니다.
> **애플리케이션 코드와 인프라 설정을 분리하는 것이 목적**입니다 — 배포 설정을 고치다 API 코드를 깨뜨리는 일을 막습니다.
>
> `server_develop`이 다루는 범위:
> - **호스팅**: Render 서비스 설정 · Dockerfile · JVM 옵션 · 헬스체크 핑(cron-job.org)
> - **데이터베이스**: Neon 프로젝트 · 연결 문자열 · 백업·복원 절차
> - **스토리지**: Cloudflare R2 버킷 · CORS · 수명주기 정책
> - **배포 파이프라인**: CI 워크플로 · Vercel 프로젝트 설정
> - **환경변수 관리**: 목록 문서화 · 로테이션 절차 (값 자체는 커밋 금지)
> - **운영 문서**: 계정 소유권 · 장애 대응 · 교회 명의 이관 절차

**어디에 속하는지 애매할 때**
| 예 | 어디로 |
|---|---|
| `application.yml`의 HikariCP 풀 사이즈 | `backend_develop` (앱 설정) |
| Render 환경변수 목록 문서화 | `server_develop` |
| Dockerfile JVM 옵션 (`-Xmx400m`) | `server_develop` |
| CI 워크플로 수정 | `server_develop` |
| `next.config.ts` 프록시 설정 | `frontend_develop` |
| Vercel 환경변수 | `server_develop` (배포 설정) |

### 6.4 브랜치 이름 규칙

```
feat/fe-<기능>        프론트엔드 기능      예: feat/fe-photo-lightbox
feat/be-<기능>        백엔드 기능          예: feat/be-jwt-auth
feat/infra-<기능>     인프라·배포          예: feat/infra-render-deploy

fix/fe-*  fix/be-*  fix/infra-*     버그 수정
docs/<주제>                          문서 (develop에서 직접 분기 가능)
```
- 소문자 + 하이픈. 한글·공백·대문자 사용하지 않음
- 기능 이름은 **무엇을 하는지** 알 수 있게. `feat/be-work` ❌ / `feat/be-photo-upload-issue` ✅

### 6.5 머지 흐름

```
feat/fe-*  ──PR──▶  frontend_develop  ──PR──▶  develop  ──PR──▶  main
feat/be-*  ──PR──▶  backend_develop   ──PR──▶  develop  ──PR──▶  main
feat/infra-* ─PR──▶  server_develop    ──PR──▶  develop  ──PR──▶  main
```

| 단계 | 방식 | 승인 | 시점 |
|---|---|---|---|
| `feat/*` → `*_develop` | **Squash merge** | 셀프 머지 허용 | 작업 완료 시 |
| `*_develop` → `develop` | **Merge commit** | 상대에게 알림 | **통합 체크포인트(§7)** |
| `develop` → `main` | **Merge commit** | 공동 확인 | **마일스톤 배포 시** |

- `*_develop` → `develop` 은 **아무 때나 하지 않습니다.** §7의 통합 체크포인트에 맞춰 올립니다.
  자기 영역이 동작하는 상태로 정리된 뒤에 합칩니다
- ⚠️ **`[CONTRACT]` PR(API 계약 변경)은 상대 승인 필수** — 어느 단계든 예외 없음

### 6.6 ⚠️ 브랜치 드리프트 방지 — 정기 동기화

계층이 4단이라 **오래 두면 `*_develop`이 `develop`에서 멀어집니다.** 나중에 합칠 때 충돌이 커집니다.

```bash
# 주 2회 동기화 때 각자 실행 (자기 통합 브랜치에서)
git checkout backend_develop
git pull origin develop        # develop의 변경을 가져옴
git push origin backend_develop
```

**규칙**
- **주 2회 정기 동기화 때 `develop` → 자기 `*_develop`을 반드시 pull** 합니다
- `feat/*` 브랜치는 **수명을 짧게** 유지합니다. 3일 이상 열려 있으면 쪼개는 것을 고려하세요
- `docs/**` 변경은 `develop`에 먼저 반영되므로, 문서를 참조하려면 동기화가 필요합니다

> 실제로 이 구조에서 문제가 생기는 지점은 충돌이 아니라 **"내 브랜치에는 있는데 상대 브랜치에는 없는 문서·설정"** 입니다. 동기화를 건너뛰지 마세요.

### 6.7 정리 규칙
- 머지된 `feat/*` 브랜치는 **삭제**합니다 (GitHub PR 머지 시 자동 삭제 옵션 켜두기)
- `main` · `develop` · `*_develop` 5개는 **영구 브랜치**입니다. 삭제하지 않습니다

### 6.8 커밋 메시지
```
<type>(<scope>): <내용>

type   feat · fix · refactor · docs · test · chore
scope  fe · be · infra · docs
```
```
feat(fe): 사진 그리드 무한 스크롤
feat(be): 카카오 OAuth 콜백 처리
feat(infra): Render 배포 파이프라인 구성
fix(be): 예산안 조회 시 인가 검사 누락
test(be): 인가 매트릭스 posts 항목 추가
docs: API 계약 에러코드 STORAGE_LIMIT 추가
```

### 6.9 PR 규칙
| PR 방향 | 규칙 |
|---|---|
| `feat/*` → 자기 `*_develop` | **셀프 머지 허용** (2인 팀 속도 확보) |
| `*_develop` → `develop` | 상대에게 알림. 통합 체크포인트(§7)에 맞춰 |
| `develop` → `main` | 공동 확인 후 (마일스톤 배포) |
| **`[CONTRACT]` 태그 (API 계약 변경)** | **상대 승인 필수** — 단계 무관 |
| `docs/**` 변경 | 머지 후 상대에게 알림 |
| 루트 설정·CI 변경 (`server_develop`) | 상대 승인 필수 |

⚠️ **PR 대상 브랜치를 확인하세요.** GitHub 기본 대상이 `develop`으로 되어 있어,
`feat/*`를 올릴 때 자기 `*_develop`으로 바꿔주지 않으면 단계를 건너뛰게 됩니다.

**PR 템플릿** (`.github/pull_request_template.md`)
```markdown
## 무엇을
<!-- 한 줄 요약 -->

## 상대에게 영향이 있나요?
- [ ] 없음 (내 디렉터리 안에서만)
- [ ] 있음 — API 계약 변경 → 제목에 [CONTRACT] 붙였는지 확인
- [ ] 있음 — 문서 변경

## 확인한 것
<!-- FE: 모바일/데스크톱, 로딩·빈·에러 상태 -->
<!-- BE: 권한별 접근 테스트(허용/거부), 마이그레이션 재현 -->
```

### 6.10 머지 방식 요약
| 단계 | 방식 | 이유 |
|---|---|---|
| `feat/*` → `*_develop` | Squash merge | 작업 단위 1커밋 → 히스토리 깔끔 |
| `*_develop` → `develop` | Merge commit | 영역별 통합 시점 보존 |
| `develop` → `main` | Merge commit | 마일스톤 배포 시점 보존 |

머지 전 상위 브랜치를 pull해 최신화합니다 (§6.6).

### 6.11 ⚠️ `main` 보호는 규칙으로만 지킨다
무료 플랜의 **Private 저장소에서는 브랜치 보호를 걸 수 없습니다** (GitHub Pro 필요).
따라서 아래는 **기술적 강제 없이 두 사람이 지켜야 하는 약속**입니다.

- ❌ `main`에 직접 push하지 않는다. **반드시 `develop`을 경유**한다
- ❌ `main`에 force push하지 않는다
- ✅ `main`으로 가는 것은 **마일스톤 배포 시점의 `develop` 머지**뿐이다
- GitHub 기본 브랜치를 `develop`으로 설정해 두었다 → `git clone` 시 `develop`이 체크아웃되고,
  PR 생성 시 기본 대상도 `develop`이 된다. **실수로 `main`에 올리는 경로를 줄이는 장치다**

실수로 `main`에 직접 push했다면 즉시 상대에게 알립니다. 되돌리기(`git revert`)는 협의 후에 합니다.

> ⚠️ **기술적 차단 장치는 없습니다.** 로컬 pre-push 훅은 `--no-verify`로 우회되고 설치가 각자
> 손에 달려 있어 폐기했습니다(근거: [`CICD.md`](CICD.md) §1). 대신 **CI 상태를 보고 머지를
> 통제**합니다 — 통합 브랜치로 넘어가는 지점에서 막는 구조입니다. → [`CICD.md`](CICD.md) §4

> 저장소를 Public으로 바꾸면 브랜치 보호를 무료로 쓸 수 있습니다. 다만 문서에 교회 내부 정보가 있어 권장하지 않습니다.

## 7. ★ 통합 체크포인트

각 마일스톤 끝에 **의도적으로 시간을 떼어** 붙입니다. "다 만들고 마지막에 한 번" 은 실패합니다.

### 통합 #1 — M1 말 (공개 사이트 + 프록시)
- [ ] FE `next.config.ts` rewrites로 `/api/**` → Spring 프록시 동작
- [ ] `NEXT_PUBLIC_USE_MOCK=0` 으로 공개 공지 목록 실연동
- [ ] 새가족 폼 제출 → DB 저장 → 담당자 메일 수신
- [ ] 에러 케이스: 필수값 누락 시 `VALIDATION_ERROR` + `field` 정확히 전달
- [ ] **배포 환경에서도 프록시 동작** (Vercel → Render)
- [ ] Render 콜드스타트 시 FE가 로딩 상태를 표시 (빈 화면 아님)

> ⚠️ **프록시를 M1에 반드시 관통시키세요.** M2에서 인증과 프록시를 동시에 디버깅하면 시간이 두 배로 듭니다.

### 통합 #2 — M2 말 (인증)
- [ ] 로그인 → 쿠키 발급 → 새로고침 후에도 세션 유지
- [ ] 액세스 토큰 만료 → 자동 refresh → 사용자는 눈치채지 못함
- [ ] `PENDING` 계정으로 로그인 → `/pending` 화면 고정 (다른 경로 접근 불가)
- [ ] 승인 후 재로그인 → 회원 영역 접근 가능
- [ ] 카카오 로그인 → 신규 계정 → `/signup/complete` 리다이렉트
- [ ] 로그아웃 → 쿠키 삭제 → 리프레시 토큰 폐기 확인
- [ ] **권한 없는 경로 직접 입력** (`/admin/members`를 MEMBER로) → 404
- [ ] 쿠키가 `HttpOnly; Secure; SameSite=Lax` 인지 브라우저에서 확인

### 통합 #3 — M3 말 (업로드 파이프라인) ★최대 위험
- [ ] 사진 1장 업로드 관통 (issue → PUT → commit)
- [ ] **200장 업로드** — 진행률 정확, 동시 3~4개 유지
- [ ] 일부 실패 후 **실패 항목만 재시도** → 같은 photoId로 URL 재발급
- [ ] 용량 95% 도달 → `STORAGE_LIMIT` → FE가 안내 표시
- [ ] 앨범 삭제 → R2 객체까지 삭제 (Cloudflare 콘솔에서 확인)
- [ ] 미커밋 `PENDING` 24시간 후 정리 배치 동작
- [ ] 사진 개별 다운로드 → 파일명·확장자 정상
- [ ] ZIP 다운로드 30장 → 시간 내 완료
- [ ] 주보 이미지 순서(`sort_order`)가 업로드 순서와 일치

### 통합 #4 — M4 말 (월례회 + 보안) ★
- [ ] 월례회 PDF 업로드 → 10페이지 변환 → 이미지 표시
- [ ] **워터마크에 열람자 이름·시각이 정확히 합성** (다른 계정으로 열어 비교)
- [ ] **열람 기간 종료 후 회원 접근 → 403** → FE가 `종료됨` 화면 표시
- [ ] **임원 계정은 기간 종료 후에도 열람 가능**
- [ ] 네트워크 탭에서 **R2 키·presigned URL이 노출되지 않음** 확인
- [ ] 업로드한 PDF 원본이 서버·R2에 남아있지 않음
- [ ] **`BACKEND_TASKS.md §13` 보안 체크리스트 전항 공동 검증**
- [ ] `ARCHITECTURE.md §5.3` 인가 매트릭스 전항 통과

---

## 8. 로컬 개발 환경 연동

### 8.1 포트
| 서비스 | 포트 |
|---|---|
| Next.js | `3000` |
| Spring Boot | `8080` |
| PostgreSQL (Docker) | `5432` |

### 8.2 FE → BE 프록시
```ts
// frontend/next.config.ts
async rewrites() {
  return [{
    source: '/api/:path*',
    destination: `${process.env.API_ORIGIN}/api/:path*`,
  }];
}
```
```bash
# frontend/.env.local
API_ORIGIN=http://localhost:8080
NEXT_PUBLIC_USE_MOCK=1        # BE 미구현 구간은 1, 실연동 시 0
```
```bash
# 운영 (Vercel 환경변수)
API_ORIGIN=https://light-api.onrender.com
NEXT_PUBLIC_USE_MOCK=0
```

**이 방식의 이점**: 브라우저는 항상 자기 출처(`localhost:3000/api/...`)로 요청하므로
- **CORS 설정이 불필요**합니다
- httpOnly 쿠키가 서드파티 쿠키가 되지 않습니다 (Safari 차단 회피)

⚠️ `API_ORIGIN`에 `NEXT_PUBLIC_` 을 붙이지 마세요. 프록시는 서버에서만 이뤄집니다.

### 8.3 BE 로컬 DB
```bash
docker run -d --name light-db -p 5432:5432 \
  -e POSTGRES_PASSWORD=local -e POSTGRES_DB=light postgres:16
```
로컬은 Docker Postgres, 운영은 Neon. `application-local.yml` / `application-prod.yml` 분리.

### 8.4 상대 코드를 실행해야 할 때
평소에는 필요 없지만, 통합 시점에는 양쪽을 띄워야 합니다.
```bash
# 터미널 1
cd backend && ./gradlew bootRun

# 터미널 2
cd frontend && npm run dev
```
→ `README.md`에 이 2줄을 적어두세요.

---

## 9. 문제 발생 시 — 누구 책임인지 5분 안에 판별하기

통합 시점에 "왜 안 되지?"로 시간을 낭비하지 않기 위한 표입니다.

| 증상 | 먼저 확인 | 대체로 누구 |
|---|---|---|
| 404 (경로 없음) | 브라우저 네트워크 탭의 실제 요청 URL | 경로 오타 → 양쪽 대조 |
| **CORS 에러** | 프록시를 안 타고 BE에 직접 요청 중 | **FE** (rewrites 설정) |
| 401인데 로그인했음 | 쿠키가 요청에 실려 갔는지 | 쿠키 속성 → BE / 프록시 → FE |
| 403인데 권한 있음 | 토큰의 role 클레임 값 | **BE** (RoleHierarchy) |
| 응답 형태가 다름 | Swagger의 실제 스키마와 대조 | 계약 위반 → §5 절차 |
| ID가 이상한 숫자로 | 숫자로 직렬화되었는지 | **BE** (문자열 규칙) |
| 화면은 되는데 데이터 없음 | `NEXT_PUBLIC_USE_MOCK` 값 | **FE** (mock 켜짐) |
| 첫 요청만 매우 느림 | Render 콜드스타트 | 정상. 로딩 표시가 있는지 확인 |
| DB 연결 오류 (운영) | HikariCP pool size | **BE** (Neon 연결 제한, 3으로) |
| 파일이 안 올라감 | presigned URL 만료(15분) | 재발급 → 양쪽 협의 |
| 이미지가 깨져 보임 | R2 키 존재 여부 | **BE** (commit 누락) |

**판별 원칙**: 브라우저 **네트워크 탭의 실제 요청/응답**을 먼저 봅니다. 추측하지 말고 실제 값을 확인하세요.

---

## 10. CI (최소 구성)

과하게 만들 필요는 없습니다. **"머지했는데 빌드가 깨졌다"만 막으면 충분**합니다.

```yaml
# .github/workflows/frontend-ci.yml   → paths: frontend/**
#   npm ci → lint → tsc --noEmit → build
#
# .github/workflows/backend-ci.yml    → paths: backend/**
#   postgres 서비스 컨테이너 + ./gradlew build  (★ 인가 테스트 포함)
```
경로 필터(`on.pull_request.paths`)로 분리했으므로 **바뀐 쪽만 실행**됩니다.
실제 파일은 저장소의 `.github/workflows/` 참조.

### 10.1 Jenkins와의 역할 분담
CI/CD를 Jenkins로도 구축합니다 (학습 + 배포 자동화). 같은 일을 두 곳에서 하지 않도록 역할을 나눕니다.

| | GitHub Actions | Jenkins |
|---|---|---|
| 역할 | **PR 검증** (항상 동작) | **CI 상세 + CD(배포)** |
| 장점 | 운영 부담 0, PC 꺼져도 동작 | 배포 제어, 파이프라인 시각화 |

⚠️ **Jenkins도 GitHub Actions도 push를 막을 수 없습니다.** push가 먼저 일어나고 CI는 그 뒤에 실행됩니다.
그래서 **push는 막지 않고 머지를 막습니다** — `feat/*`에 깨진 커밋은 허용, CI가 ❌면 머지 금지.
→ [`CICD.md`](CICD.md) §1·§4

⚠️ **BE의 인가 테스트가 CI에서 돌아야 합니다.** 권한 회귀를 사람이 기억으로 막을 수는 없습니다.

---

## 11. 배포

| | 대상 | 트리거 | 비용 |
|---|---|---|---|
| FE | Vercel | `main` push 자동 | $0 |
| BE | Render | `main` push 자동 (Docker) | $0 |
| DB | Neon | — | $0 |
| 파일 | Cloudflare R2 | — | $0 |

### 11.1 배포 순서 (계약 변경이 있을 때)
```
비호환 변경 시:  BE 먼저 배포 → 동작 확인 → FE 배포
호환 추가 시:    순서 무관
```
BE를 먼저 올려야 FE가 없는 필드를 호출하는 상황을 피할 수 있습니다.

### 11.2 마일스톤 배포 시 확인
- [ ] `develop` → `main` 머지 전 §7 통합 체크포인트 통과
- [ ] Vercel 환경변수 `API_ORIGIN`, `NEXT_PUBLIC_USE_MOCK=0`
- [ ] Render 환경변수 전체 설정 (`BACKEND_TASKS.md §3.3`)
- [ ] Render 헬스체크 핑(cron-job.org) 동작
- [ ] 실기기(휴대폰)에서 확인

---

## 12. 소통 규칙

| 항목 | 규칙 |
|---|---|
| 정기 동기화 | **주 2회 30분** — 접점 진행 / 막힌 것 / 계약 변경 |
| **1시간 룰** | 혼자 1시간 넘게 막히면 상대에게 공유. 하루 4시간 예산에서 큰 손실 |
| 계약 변경 | **즉시** 공유 (§5) |
| 결정 기록 | `WORKPLAN.md §10`에 append — **구두 합의는 잊힙니다** |
| 엔드포인트 완성 | 즉시 알림 → FE가 mock에서 전환 |

---

## 13. 착수 즉시 할 일 (W0, 공동 4h)

| # | 작업 | 담당 |
|---|---|---|
| 1 | 저장소 생성 · 브랜치 보호 · `.gitignore` · PR 템플릿 (§2.3) | 공동 |
| 2 | **API 계약 확정** — 엔드포인트·에러코드·직렬화 규칙 (§3) | 공동 ★ |
| 3 | **업로드 파이프라인 4개 항목 합의** (`BACKEND_TASKS.md §8`) | 공동 |
| 4 | Next.js 초기화 + 프록시 설정 | FE |
| 5 | Spring 초기화 + Neon·R2·Render 생성 (**계정 기록**) | BE |
| 6 | 이 문서 함께 읽고 규칙 합의 | 공동 |

> **W0을 건너뛰면 M2~M3에 통합 지옥이 옵니다.** 4시간 투자로 수십 시간을 아낍니다.

---

## 14. 한 장 요약 (붙여두고 보기)

```
[ 소유권 ]  frontend/ = FE 단독   backend/ = BE 단독   docs/ = 공동

[ 브랜치 ]  main ← develop ← frontend_develop ← feat/fe-*
                            ← backend_develop  ← feat/be-*
                            ← server_develop   ← feat/infra-*
            ★ *_develop 에서 직접 작업하지 않는다. 하위 브랜치를 한 번 더 판다
            ★ 주 2회 develop → 자기 *_develop 동기화 (드리프트 방지)

[ CI ]      push는 자유 → CI 실행 → ✅면 머지 / ❌면 수정 후 재push
            ★ PR에 ❌가 있으면 머지하지 않는다 (기술적 강제 없음 = 팀 규칙)
            시크릿은 .gitignore + CI 스캔. 올라갔으면 키 재발급

[ 계약 ]    응답  { "data": ... }  /  { "error": { code, message, field } }
            ID는 문자열 · 날짜는 ISO-8601 · 파일은 presigned URL
            에러코드 7개만: UNAUTHORIZED FORBIDDEN NOT_FOUND
                          VALIDATION_ERROR PENDING_APPROVAL
                          STORAGE_LIMIT DUPLICATE

[ 변경 ]    비호환 변경 = 사전 합의 + PR 제목에 [CONTRACT] + 상대 승인
            조용히 바꾸지 않는다

[ mock ]    FE는 lib/api/index.ts 만 import
            NEXT_PUBLIC_USE_MOCK=1 → BE 없이 개발

[ 통합 ]    M1 프록시 · M2 인증 · M3 업로드(최대위험) · M4 월례회+보안
            마일스톤마다 반드시 시간을 떼어 붙인다

[ 막힘 ]    1시간 넘으면 공유 · 네트워크 탭 먼저 확인
```
