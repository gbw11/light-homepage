# LIGHT — 김해교회 청년교회 홈페이지

> **L**ive **I**n **G**od, **H**elp **T**he other

김해교회 청년교회(LIGHT)의 공개 홈페이지 + 회원 전용 포털.

- 청년예배: 주일 14:00 · **드림센터 4층** (본당과 별개 건물)
- 마을모임: 예배 후 15:30~16:00 · 1마을~9마을 + 새가족마을
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
├─ frontend/     Next.js 15 + TypeScript + Tailwind   ← FE 단독 소유
├─ backend/      Spring Boot 3 + Java 21              ← BE 단독 소유
├─ docs/         기획·설계 문서                          ← 공동
└─ .github/      CI · PR 템플릿
```

> ⚠️ `frontend/`와 `backend/`는 **각 담당자가 단독 소유**합니다. 상대 디렉터리를 수정하지 않습니다.
> 자세한 규칙은 [`docs/INTEGRATION.md`](docs/INTEGRATION.md)

---

## 실행

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
| [**BACKEND_TASKS.md**](docs/BACKEND_TASKS.md) | **백엔드** | 작업 지시서 (이것만 읽어도 작업 가능) |

**배경 문서**

| 문서 | 내용 |
|---|---|
| [PLAN.md](docs/PLAN.md) | 기획 — 목표·사용자·정보구조·권한 모델 |
| [WIREFRAME.md](docs/WIREFRAME.md) | 화면 설계 21개 (모바일 우선) |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | 시스템 설계 — 스택·데이터·API·보안 |
| [WORKPLAN.md](docs/WORKPLAN.md) | 일정·시간 산정·역할 분담 |

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
5. **시크릿을 커밋하지 않는다** — `JWT_SECRET`, R2 키, DB 비밀번호

---

## 팀

| 역할 | 담당 영역 |
|---|---|
| 프론트엔드 | `frontend/` · 디자인 시스템 · 화면 · PWA · SEO |
| 백엔드 | `backend/` · DB · 인증·인가 · 파일 · 배포 |
