# LIGHT — 김해교회 청년교회 홈페이지

> **L**ive **I**n **G**od, **H**elp **T**he other

김해교회 청년교회(LIGHT)의 공개 홈페이지 + 회원 전용 포털.

- 청년예배: 주일 14:00 · **드림센터 4층** (본당과 별개 건물)
- 마을모임: 예배 후 30분정도 진행
- 대상 연령: 20세~39세 또는 결혼 전

---

## 구성

| 영역 | 대상 | 기술 |
|---|---|---|
| **공개** | 비로그인 방문자 | Next.js SSG (SEO·카카오톡 공유 미리보기) |
| **회원** | 로그인 청년 | Next.js CSR + Spring API |
| **운영** | 임원·전도사 | Next.js CSR + Spring API |

```
사용자 ──▶ Vercel (Next.js) ──/api/**─▶ Render (Spring Boot) ──▶ Neon (PostgreSQL)
                                                              └─▶ Cloudflare R2 (파일)
```

**전체 인프라 비용 $0** (무료 티어 내 운영)

---

## 저장소 구조

```
light-homepage/
├─ frontend/     Next.js 16 + TypeScript + Tailwind v4  ← FE 단독 소유
├─ backend/      Spring Boot 3 + Java 21              ← BE 단독 소유
├─ infra/        Jenkins · Render · Neon 인프라 구성      ← server_develop 소유
├─ docs/         기획·설계 문서                          ← 공동
├─ .github/      GitHub Actions CI · PR 템플릿
└─ Jenkinsfile   Jenkins 파이프라인 정의
```

> ⚠️ `frontend/`와 `backend/`는 **각 담당자가 단독 소유**합니다. 상대 디렉터리를 수정하지 않습니다.
> 자세한 규칙은 [`docs/INTEGRATION.md`](docs/INTEGRATION.md)

---

## 브랜치 전략

```
main                    배포 (마일스톤 릴리스만)
└─ develop              전체 통합
   ├─ frontend_develop  ← feat/fe-*      프론트엔드
   ├─ backend_develop   ← feat/be-*      백엔드 (Spring 애플리케이션)
   └─ server_develop    ← feat/infra-*   서버·인프라·배포
```

> ⚠️ **`*_develop`에서 직접 작업하지 않습니다.** 반드시 하위 브랜치(`feat/*`)를 한 번 더 만들어
> 작업하고 PR로 올립니다. 자세한 규칙은 [`docs/INTEGRATION.md §6`](docs/INTEGRATION.md)

```bash
git checkout backend_develop
git pull origin backend_develop
git checkout -b feat/be-jwt-auth     # ← 여기서 작업
```

머지 흐름: `feat/*` → `*_develop` → `develop` → `main`

---

## CI — push하고, 통과하면 머지

clone 직후 별도 설정은 없습니다. 바로 작업하면 됩니다.

```
feat/* 에서 작업 → push (몇 번이든) → CI 실행 → ✅ 통과하면 PR 머지
                                              ❌ 실패하면 같은 브랜치에서 수정 후 재push
```

- CI는 **Jenkins**(전체 검증 + 배포)와 **GitHub Actions**(PR 검증)가 함께 돕니다
- `feat/*` 브랜치에는 깨진 커밋이 올라가도 됩니다. **막는 지점은 push가 아니라 머지입니다**
- ⚠️ **PR에 ❌가 있으면 머지하지 않습니다.** 무료 Private 저장소라 기술적 강제가 없는 **팀 규칙**입니다

설계 근거와 파이프라인 구성 → [`docs/CICD.md`](docs/CICD.md)

---

## 실행

**필요 버전** — 전원 동일하게 맞춥니다 ([TOOLCHAIN.md](docs/TOOLCHAIN.md))

| | 버전 | |
|---|---|---|
| Node.js | **22 LTS** | 프론트엔드 |
| Java (Temurin) | **21** | 백엔드 |
| PostgreSQL | **16** | 로컬·CI·운영 동일 |

```bash
# 백엔드 (터미널 1)
cd backend && ./gradlew bootRun          # → localhost:8080

# 프론트엔드 (터미널 2)
cd frontend && npm run dev               # → localhost:3000
```

`/api/**` 요청은 Next.js `rewrites`로 백엔드에 프록시됩니다 (동일 출처 → CORS 불필요).
백엔드 없이 프론트만 개발할 때는 `frontend/.env.local`에 `NEXT_PUBLIC_USE_MOCK=1`.

---

## 문서

**먼저 읽어야 할 것**

| 문서 | 대상 | 내용 |
|---|---|---|
| [**INTEGRATION.md**](docs/INTEGRATION.md) | **양쪽 필독** | 협업·병합 규칙, API 계약, 통합 체크포인트 |
| [**TOOLCHAIN.md**](docs/TOOLCHAIN.md) | **양쪽 필독** | 도구 버전 고정 — Node 22 · Java 21 · Postgres 16 · 포트 |
| [**ONBOARDING_BACKEND.md**](docs/ONBOARDING_BACKEND.md) | **백엔드 첫날** | 어떤 파일을 어떤 순서로 읽을지 |
| [**BACKEND_TASKS.md**](docs/BACKEND_TASKS.md) | **백엔드** | 작업 지시서 (이것만 읽어도 작업 가능) |

**배경 문서**

| 문서 | 내용 |
|---|---|
| [PLAN.md](docs/PLAN.md) | 기획 — 목표·사용자·정보구조·권한 모델 |
| [WIREFRAME.md](docs/WIREFRAME.md) | 화면 설계 21개 (모바일 우선) |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | 시스템 설계 — 스택·데이터·API·보안 |
| [WORKPLAN.md](docs/WORKPLAN.md) | 일정·시간 산정·역할 분담 |
| [CICD.md](docs/CICD.md) | Jenkins CI/CD 설계 · 머지 게이트 |
| [**COST_GUARDRAILS.md**](docs/COST_GUARDRAILS.md) | **과금 방지 설계 — 외부 서비스를 추가하기 전에 읽습니다** |

**명세서**

| 문서 | 내용 |
|---|---|
| [SPEC_FUNCTIONAL.md](docs/SPEC_FUNCTIONAL.md) | 기능 명세 — 63개 기능, 역할·마일스톤·수용 기준 |
| [SPEC_NONFUNCTIONAL.md](docs/SPEC_NONFUNCTIONAL.md) | 비기능 명세 — 성능·가용성·보안·개인정보·비용 목표 |
| [SPEC_API.md](docs/SPEC_API.md) | **API 명세 — FE·BE 계약서** |

---

## 마일스톤

| | 내용 | FE | BE | 누적 |
|---|---|---|---|---|
| **M1** | 공개 사이트 · 공개 공지 · 새가족 폼 · SEO | 101h | 46h | ~4주 |
| **M2** | 인증(이메일·카카오) · 회원 승인 · 내부 공지 | 44h | 82h | ~7.5주 |
| **M3** | 사진첩(업로드·다운로드) · 주보 · 용량 관리 | 62h | 60h | ~10주 |
| **M4** | 문서 게시판 · 월례회 · 인가 테스트 · PWA | 75h | 73h | ~13주 |

기준: 1인 4h/일 · 주 7일 (28h/주). 상세는 [WORKPLAN.md](docs/WORKPLAN.md).

---

## ⚠️ 반드시 지킬 것

1. **권한은 서버에서 검사한다.** UI에서 메뉴를 숨기는 것은 보안이 아니다
2. **인가 테스트 매트릭스**([ARCHITECTURE.md §5.3](docs/ARCHITECTURE.md))가 통과해야 배포한다 — RLS가 없으므로 이것이 마지막 방어선
3. **API 계약을 조용히 바꾸지 않는다** — 비호환 변경은 `[CONTRACT]` PR + 상대 승인
4. **비용 $0을 넘기지 않는다** — R2 95% 도달 시 업로드 차단
5. **시크릿을 커밋하지 않는다** — `JWT_SECRET`, R2 키, DB 비밀번호 (`.gitignore`가 1차, CI 스캔이 2차. 올라간 뒤엔 **키 재발급만이 복구**)
6. **`*_develop`에서 직접 작업하지 않는다** — 하위 `feat/*` 브랜치를 한 번 더 만든다

---

## 팀

| 역할 | 담당 영역 |
|---|---|
| 프론트엔드 | `frontend/` · 디자인 시스템 · 화면 · PWA · SEO |
| 백엔드 | `backend/` · DB · 인증·인가 · 파일 · 배포 |
