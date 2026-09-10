# API 명세서 — LIGHT

- 문서 버전: **v1.3** (2026-08-31 — 로그인·권한 재설계 **확정** 반영: §2 전면 개정(명단 대조 가입·loginId 로그인·리셋 코드) · §3.1 열람 권한 되돌림 · §8 승인 폐지 · §10 매트릭스 교체. 근거: `handoff/2026-08-28-auth-roster-model.md` §9 BE 답변 + `DECISIONS.md` 2026-08-31)
- Base URL: `/api` (Next.js `rewrites`로 Spring에 프록시 → **동일 출처**)
- 이 문서의 역할: **FE와 BE의 유일한 접점.** W0에서 이 문서를 합의한 뒤 각자 작업한다
- 구현되면 **Swagger UI**(`/swagger-ui.html`)가 살아있는 계약서가 되고, 이 문서는 합의 기준으로 남는다

> ⚠️ **비호환 변경은 조용히 하지 않습니다.** PR 제목에 `[CONTRACT]`를 붙이고 상대 승인을 받습니다 ([`INTEGRATION.md §5`](../ops/INTEGRATION.md))

> ### ⚠️ 2026-08-25 권한 모델 전환 — 이 문서의 권한 표기는 아래 규칙이 우선합니다
>
> PM 결정으로 **열람은 로그인 없이 가능**해졌고, 로그인은 **올리거나 관리하는 사람의 관문**이 됐습니다.
> 아래 §2~§8의 개별 `권한` 줄은 전환 결과를 반영해 갱신했습니다. 근거와 전체 맥락:
> [`handoff/2026-08-25-public-read-model.md`](../handoff/2026-08-25-public-read-model.md) · `DECISIONS.md` 2026-08-25
>
> 요약하면 세 가지입니다.
> 1. **열람 엔드포인트 12개가 익명 허용**으로 바뀌었습니다 (`§3.2` `§3.3` `§4.2` `§5.1~5.3` `§6.1` `§6.4` `§6.7` `§6.10` `§7.1~7.3`)
> 2. **`BUDGET`(예산안)만 `L` 유지** — 권한이 없으면 `403`이 아니라 **`404`** 로 존재를 숨깁니다 (`§3.1` `§3.3`)
> 3. **`§6.8` ZIP 대량 다운로드는 폐기** — 구현하지 않습니다
>
> **쓰기·관리 권한은 하나도 바뀌지 않았습니다.**
>
> ⚠️ **2026-08-31 부분 철회**: 위 1의 열람 공개 중 **내부공지·회의록·사진첩·월례회는
> 다시 `M`(회원 전용)**이 됐습니다 (`§3.1` `§10`). 주보·설교·공개공지·새가족 접수는
> 공개로 남습니다. 근거: `handoff/2026-08-28-auth-roster-model.md` §1·§3.

---

## 1. 공통 규약

### 1.1 응답 형태
```json
// 성공
{ "data": { } }

// 성공 (목록)
{ "data": { "items": [], "page": 0, "size": 20, "hasNext": true } }

// 성공 (커서 목록 — 사진 전용)
{ "data": { "items": [], "nextCursor": "eyJpZCI6MTIzfQ", "hasNext": true } }

// 실패
{ "error": { "code": "FORBIDDEN", "message": "권한이 없습니다.", "field": null } }
```

`@RestControllerAdvice`로 모든 예외를 이 형태로 통일합니다. FE는 에러 처리를 한 곳에서 만듭니다.

### 1.2 에러 코드 — FE가 분기하는 것은 이 6개뿐 (전체는 8개)
FE가 분기에 쓰는 값이므로 집합을 벗어나지 않습니다.
~~`PENDING_APPROVAL`~~ 은 v1.3(2026-08-31)에서 제거됐습니다 — 승인 절차 소멸 (`[CONTRACT]` 합의).

| code | HTTP | 의미 | FE 처리 |
|---|---|---|---|
| `UNAUTHORIZED` | 401 | 로그인 필요 | 로그인 화면으로 |
| `FORBIDDEN` | 403 | 권한 부족 | 접근 불가 안내 |
| `NOT_FOUND` | 404 | 없음 또는 **권한이 없어 숨김** | 404 화면 |
| `VALIDATION_ERROR` | 400 | 입력값 오류 (`field`에 필드명) | 해당 입력란에 표시 |
| `STORAGE_LIMIT` | 409 | 저장 용량 초과 | 업로드 차단 + 안내 |
| `DUPLICATE` | 409 | 중복 (`loginId`·주보 날짜 등) | 해당 입력란에 표시 |

**그 외 1개 — 분기용이 아닙니다.**

| code | HTTP | 의미 | FE 처리 |
|---|---|---|---|
| `INTERNAL_ERROR` | 500 | 서버 오류 | **분기하지 않습니다** — 공통 안내 문구만 |

`INTERNAL_ERROR`는 처리되지 않은 예외를 봉투 형태로 통일하기 위한 값입니다. FE가 이 값으로
화면을 나누는 일은 없어야 하고, 나눠야 하는 상황이면 그건 전용 코드가 필요하다는 뜻입니다.
(2026-08-31 `[CONTRACT]` 합의, PR #74)

**그리고 1개 더 — 이것도 분기용이 아닙니다.**

| code | HTTP | 의미 | FE 처리 |
|---|---|---|---|
| `RATE_LIMITED` | 429 | 요청이 너무 잦음 | "잠시 후 다시 시도해주세요" 안내만 |

`POST /api/newcomers`(`§9.1`)에서만 씁니다 — 동일 IP 5분 5회 초과.
`INTERNAL_ERROR`와 같은 PR #74(`[CONTRACT]` 태그)로 들어가 머지됐습니다.

> ⚠️ **2026-09-10 정정.** 이 자리에는 「`INTERNAL_ERROR`와 함께 아직 `[CONTRACT]`
> 합의가 남아 있습니다」가 적혀 있었습니다. 그런데 바로 위 `INTERNAL_ERROR` 문단은
> **같은 PR #74에서 합의됐다**고 적고 있어 문서가 자기모순이었습니다.
> 두 코드는 같은 PR로 들어갔으므로 상태가 다를 수 없습니다.
>
> **FE에 한 번 확인이 필요합니다** — PR #74 승인이 두 코드를 모두 포함한 것으로
> 읽히지만, `RATE_LIMITED`만 따로 이견이 있었다면 알려주세요. 표에 행을 넣은 것은
> 코드(`kr.light.common.ErrorCode`)와 문서의 형태를 맞추기 위한 것이며, 이 문단이
> 합의 내용을 새로 만들지는 않습니다.

> ⚠️ **인증(`§2`)에서는 `RATE_LIMITED`를 쓰지 않습니다.** `§2.1` 명단 대조 rate limit과
> `§2.3` 로그인 5회 실패 잠금은 **일반 실패와 같은 `UNAUTHORIZED`**로 응답합니다
> (`§9-G` 확정). 429나 전용 문구를 주면 "이 계정은 존재한다"·"이 조합은 명단에 있다"가
> 새어나가 계정·명단 열거에 쓰입니다. 새가족 등록은 열거할 대상이 없어 사정이 다릅니다.

### 1.3 직렬화 규칙
| 항목 | 규칙 | 예 | 이유 |
|---|---|---|---|
| ID | **문자열** | `"123"` | JS `Number` 정밀도 이슈 회피 |
| 날짜 (`LocalDate`) | `YYYY-MM-DD` | `"2026-08-24"` | |
| 시각 | ISO-8601 UTC + `Z` | `"2026-08-24T11:30:00Z"` | 타임존 혼란 방지 |
| null | 필드를 생략하지 않고 `null` 명시 | `"phone": null` | FE 옵셔널 처리 단순화 |
| 파일 URL | presigned URL (월례회 제외) | | FE는 R2 경로를 모름 |
| 열거형 | 대문자 스네이크 | `"NOTICE_PUBLIC"` | |

### 1.4 인증
- JWT를 **httpOnly 쿠키**로 발급: `HttpOnly; Secure; SameSite=Lax`
- 액세스 토큰 30분 / 리프레시 14일
- FE는 토큰을 다루지 않습니다 (`credentials: 'include'`만 필요, 동일 출처라 기본값으로 충분)
- 401 응답 시 FE가 `POST /api/auth/refresh`를 1회 시도한 뒤 실패하면 로그인 화면으로

### 1.5 권한 표기
`G` GUEST · `M` MEMBER · `L` LEADER · `T` PASTOR (계단식 상위 포함)

⚠️ **`P`(PENDING·승인 대기)는 2026-08-31 확정으로 소멸했습니다** — 명단 대조 가입은
즉시 `MEMBER`가 됩니다 (`§2.1~2.2`). 열람 권한은 **회원 콘텐츠(내부공지·회의록·
사진첩·월례회)가 `M`**, 공개 콘텐츠(공개공지·주보·설교)가 `G`입니다 (`§3.1` `§10`).

⚠️ 비공개 열람·쓰기에서 **`G`는 `401`, `M` 미달은 `403`** — FE가 "로그인하면 됨"(로그인
유도)과 "로그인해도 안 됨"(권한 없음)을 **다른 화면으로** 처리합니다 (`§10` 주의 3).

### 1.6 페이징 기본값
`page=0`, `size=20` (최대 100). 사진 목록만 커서 방식입니다.

---

## 2. 인증 (`/api/auth`)

> ### ⚠️ v1.3 전면 개정 (2026-08-31) — 절 번호가 이전 버전과 다릅니다
>
> 이메일 회원가입(구 §2.1) · 카카오 추가정보 `complete-profile`(구 §2.8) ·
> 이메일 비밀번호 재설정(구 §2.9~2.10)은 **폐기**됐습니다.
> 가입은 **교회 명단 대조 → 즉시 `MEMBER`** 2단계이며, 승인(PENDING) 절차가 없습니다.
> 마을·이메일은 받지 않습니다. 근거: `handoff/2026-08-28-auth-roster-model.md` §9 확정.

### 2.1 `POST /api/auth/verify-roster` — 명단 확인 (가입 1단계)
권한 `G`

```json
// 요청
{ "name": "김도연a", "birthDate": "2001-03-14", "phone": "010-1234-5678" }
```
| 필드 | 타입 | 필수 | 제약 |
|---|---|---|---|
| `name` | string | ✅ | 명단의 이름과 글자 그대로 비교. **동명이인은 명단의 접미사 포함** (예: `김도연a`) — 저장·표시 모두 접미사 그대로 |
| `birthDate` | string | ✅ | `YYYY-MM-DD` |
| `phone` | string | ✅ | 서버가 숫자만 남겨 정규화 후 비교 |

```json
// 200
{ "data": { "registrationToken": "...", "name": "김도연a", "expiresIn": 300 } }
```
토큰은 **1회용 · 5분 만료**입니다.

| 실패 | code | 비고 |
|---|---|---|
| 셋 중 하나라도 불일치 · 명단에 없음 · 이미 계정 있음 | `UNAUTHORIZED` | **전부 같은 문구** "명단에서 확인되지 않습니다" — 어느 필드가 틀렸는지 알려주지 않음 |
| 동명이인 2건 이상 매칭 | `VALIDATION_ERROR` | "임원에게 문의해 주세요" |
| rate limit 초과 | `UNAUTHORIZED` | **일반 실패와 동일 응답** (§9-G 확정 — 429·전용 문구 없음) |

⚠️ FE는 **필드별 오류 표시를 만들지 않습니다** — 폼 전체 단일 에러 문구 하나와
"임원 문의" 분기 하나뿐입니다.

### 2.2 `POST /api/auth/register` — 계정 생성 (가입 2단계)
권한 `G`

```json
// 요청
{ "registrationToken": "...", "loginId": "doyeon01", "password": "비밀번호12!" }
```
| 필드 | 제약 |
|---|---|
| `loginId` | 사용자가 정한 아이디 (§9-A 확정), 중복 불가 |
| `password` | 8자 이상 · **생년월일·전화번호와 같으면 거부** (`VALIDATION_ERROR`) |

```json
// 201 — 즉시 MEMBER (승인 없음, §9-B 확정)
{ "data": { "id": "42", "name": "김도연a", "role": "MEMBER" } }
```
| 실패 | code |
|---|---|
| 토큰 만료·재사용 | `UNAUTHORIZED` |
| `loginId` 중복 | `DUPLICATE` (field: `loginId`) |

✅ **BE 확정 (2026-09-01)**: **세션 쿠키를 발급하지 않습니다** — FE 가정 그대로입니다.
가입 완료 화면에서 로그인으로 유도해 주세요. 방금 정한 비밀번호를 한 번 사용해 보게 하는
편이 "가입은 됐는데 비밀번호를 잘못 기억한" 상태를 가입 직후에 잡아냅니다.

### 2.3 `POST /api/auth/login`
권한 `G`

```json
// 요청
{ "loginId": "doyeon01", "password": "비밀번호12!" }
```
```json
// 200 — 쿠키에 access/refresh 토큰이 설정된다
{ "data": { "id": "42", "name": "김도연a", "role": "MEMBER" } }
```
| 실패 | code | 비고 |
|---|---|---|
| 자격 불일치 | `UNAUTHORIZED` | |
| 5회 실패 → 15분 잠금 | `UNAUTHORIZED` | **일반 실패와 동일 응답** — FE 전용 UI 없음 |

### 2.4 `POST /api/auth/refresh`
권한 — (리프레시 쿠키 필요) · 응답 `200 { "data": { "refreshed": true } }`
리프레시 토큰은 **회전**합니다(사용 시 새로 발급). 실패는 `UNAUTHORIZED`.

### 2.5 `POST /api/auth/logout`
권한 로그인 · 쿠키 삭제 + 리프레시 토큰 DB 폐기 · `204`

### 2.6 `GET /api/auth/me`
권한 로그인
```json
{
  "data": {
    "id": "42", "name": "김도연a", "loginId": "doyeon01",
    "phone": "010-1234-5678", "role": "MEMBER"
  }
}
```
`loginId`는 카카오 가입자면 `null`. ~~`email` `village` `profileComplete` `approvedAt`~~ 은 v1.3에서 제거.

### 2.7 `GET /api/auth/kakao/authorize`
권한 `G` · **302** → 카카오 인가 URL

두 용도로 쓰입니다 (§9-F: 카카오 **유지**, 단 가입 간소화 효과 없음).
- **기존 카카오 가입자의 로그인**: 파라미터 없이 호출
- **가입 2단계의 수단 ②**: `verify-roster` 통과 후에만 진입

⚠️ 카카오는 이름·생년월일·전화번호를 주지 않으므로 **카카오만으로는 가입할 수 없습니다** —
명단 대조를 건너뛸 수 없습니다. FE 문구는 "본인 확인 후 카카오로 계속"입니다.

✅ **BE 확정 (2026-09-01)**: FE는 `GET /api/auth/kakao/authorize?registrationToken=...`으로
호출합니다. **그 뒤는 서버가 처리하며, FE는 `state`를 다루지 않습니다.**

⚠️ 서버는 `registrationToken`을 `state`에 **그대로 싣지 않습니다.** `state`는 CSRF 방어값이라
카카오 인가 URL에 노출되는데, `registrationToken`은 그것만 있으면 계정을 만들 수 있는 값입니다.
서버가 랜덤 `state`를 발급해 `state → registrationToken` 대응을 5분간 보관하고, 콜백에서
`state`로 되찾습니다.

### 2.8 `GET /api/auth/kakao/callback?code=...`
권한 `G` · **302** → FE로 리다이렉트 (쿠키 설정 후)

| 상황 | 리다이렉트 |
|---|---|
| 기존 카카오 계정 | `/my` |
| 신규 + 유효한 registrationToken | 계정 생성(즉시 MEMBER) 후 `/my` |
| 신규 + 토큰 없음/만료 | `/signup?error=kakao` (명단 확인부터 다시) |

✅ **BE 확정 (2026-09-01)**: 위 표 그대로 구현합니다. ~~구 `/signup/complete`·`/pending`
리다이렉트~~ 폐기.

⚠️ 카카오 가입자는 loginId·비밀번호가 없어 **카카오 계정을 잃으면 로그인 수단이 없습니다**
— 의도된 트레이드오프이며, 사고 시 §8.2(계정 삭제 + 명단 재개방)로 재가입합니다.

### 2.9 `POST /api/auth/password/reset-with-code` — 리셋 코드로 비밀번호 재설정
권한 `G`

```json
// 요청
{ "loginId": "doyeon01", "resetCode": "8H2K-9QX1", "password": "새비밀번호12!" }
```
`204` · 코드는 **1회용 · 30분 만료 · 해시 저장** — 전도사가 §8.4로 발급해 구두/문자로 전달합니다.
실패(코드 불일치·만료)는 `UNAUTHORIZED` 단일 응답.

~~구 §2.9 `reset-request`(이메일) · 구 §2.10 `reset`(이메일 토큰)~~ 폐기 —
이메일을 수집하지 않으므로 자력 수단은 **카카오 로그인**(카카오 가입자) 또는 전도사 문의입니다.

### 2.10 `PATCH /api/auth/me`
권한 `M` · 요청 `{ "phone": "010-9999-8888" }` · 응답 갱신된 프로필

### 2.11 `POST /api/auth/password/change`
권한 `M` · 요청 `{ "currentPassword": "...", "newPassword": "..." }` · `204`

### 2.12 `DELETE /api/auth/me` — 회원 탈퇴
권한 `M` · 요청 `{ "password": "..." }` · `204` · 개인정보 즉시 파기
⚠️ 탈퇴 시 명단 `claimed_at`도 해제해 재가입이 가능해야 합니다.

---

## 3. 게시물 (`/api/posts`)

공지·회의록·예산안을 하나의 리소스로 다룹니다.

### 3.1 분류와 권한
| category | 의미 | 열람 | 작성 |
|---|---|---|---|
| `NOTICE_PUBLIC` | 공개 공지 | 누구나 | `L` |
| `NOTICE_MEMBER` | 내부 공지 | **`M`** | `L` |
| `MINUTES` | 회의록 | **`M`** | `L` |
| `BUDGET` | 예산안 | `L` | `L` |

> **2026-08-31 확정 (§9-D)**: `NOTICE_MEMBER`·`MINUTES` 열람이 **`M`(회원 전용)으로
> 돌아왔습니다** — 2026-08-25 "누구나" 전환의 부분 철회입니다. 회의록은 구모델의
> `L`이 아니라 `M`입니다 (완화). `BUDGET`은 `L` 유지 — 헌금·지출 내역이 담기기 때문입니다.
> 열람 `M`에서 익명은 `401`(로그인 유도), 로그인했지만 미달은 `403`입니다 (§10 주의 3).

⚠️ **분류별 열람 권한 검사는 서비스 계층의 단일 관문을 통과해야 합니다.** Controller가 받은 category를 그대로 신뢰하지 않습니다.

⚠️ **권한 없는 `BUDGET` 상세 요청에는 `403`이 아니라 `404`를 줍니다.** `403`은 "그 문서가 존재한다"를 알려주는 셈입니다 (`§3.3`).
목록(`§3.2`)에서 `category=BUDGET`을 권한 없이 요청하면 `403`이 맞습니다 — 분류의 존재는 이미 공개된 정보이고, FE는 애초에 그 요청을 보내지 않습니다.

### 3.2 `GET /api/posts`
권한 **분류별 — `NOTICE_PUBLIC`은 `G`(익명 허용) · `NOTICE_MEMBER`·`MINUTES`는 `M` · `BUDGET`은 `L`**

| 쿼리 | 필수 | 설명 |
|---|---|---|
| `category` | ✅ | 위 4개 중 하나 |
| `page` `size` | — | 기본 0 / 20. **`size` 최대 100** — 넘기면 `400`이 아니라 100으로 자릅니다 |

> **★ 2026-09-10 보강 — 명세에 없어서 BE가 정한 것 3가지입니다.**
> 원래 이 절에 근거가 없었고 FE에는 PR 본문으로만 전달됐습니다. 여기 못박습니다.
>
> 1. **임시저장(`publishedAt = null`)은 목록·상세에서 제외합니다.** 명세에
>    `publishedAt`이 nullable인데 노출 규칙이 없었습니다. 쓰던 글이 공개되는 쪽이
>    더 나쁜 사고라 제외를 택했습니다.
> 2. **`size`가 100을 넘으면 `400`이 아니라 100으로 자릅니다.** 거부보다 관대한
>    쪽입니다.
> 3. **`authorName`은 실명 그대로입니다.** 위 예시의 `"박OO"` 같은 마스킹 규칙이
>    **어느 문서에도 정의돼 있지 않아** 발명하지 않았습니다. 마스킹이 필요하면
>    규칙(가운데 글자만? 성만 남김? 2글자 이름은?)을 먼저 정해 주세요 —
>    `[CONTRACT]` 변경입니다.

```json
{
  "data": {
    "items": [
      {
        "id": "18",
        "category": "NOTICE_PUBLIC",
        "title": "여름 수련회 신청 안내",
        "slug": "summer-retreat-2026",
        "pinned": true,
        "authorName": "박OO",
        "publishedAt": "2026-08-24T01:00:00Z",
        "attachmentCount": 1
      }
    ],
    "page": 0, "size": 20, "hasNext": false
  }
}
```
정렬: `pinned` 우선 → `publishedAt` 최신순
| 실패 | code |
|---|---|
| 비로그인 + 비공개 분류 | `UNAUTHORIZED` |
| 권한 부족 | `FORBIDDEN` |

### 3.3 `GET /api/posts/{idOrSlug}`
권한 **분류별 — 위와 동일. `BUDGET`은 권한 없으면 `404`**

```json
{
  "data": {
    "id": "18",
    "category": "NOTICE_PUBLIC",
    "title": "여름 수련회 신청 안내",
    "slug": "summer-retreat-2026",
    "body": { "type": "doc", "content": [] },
    "pinned": true,
    "authorName": "박OO",
    "publishedAt": "2026-08-24T01:00:00Z",
    "updatedAt": "2026-08-24T01:00:00Z",
    "attachments": [
      { "id": "7", "filename": "신청서.xlsx", "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "sizeBytes": 24576 }
    ]
  }
}
```
`body`는 리치텍스트 JSON입니다.

⚠️ **id로 먼저 조회하고 그 글의 category 권한을 확인합니다.** category를 파라미터로 받아 필터링하면 우회가 가능합니다.
권한이 없으면 **`NOT_FOUND`(404)** 를 반환해 존재 자체를 숨깁니다.

### 3.4 `POST /api/posts`
권한 `L`
```json
{
  "category": "MINUTES",
  "title": "8월 정기 회의록",
  "body": { "type": "doc", "content": [] },
  "pinned": false,
  "attachmentIds": ["7", "8"],
  "publish": true
}
```
`publish: false`면 임시저장(`publishedAt = null`)입니다. `201 { "data": { "id": "19" } }`

### 3.5 `PUT /api/posts/{id}` · `DELETE /api/posts/{id}`
권한 `L` · 수정은 3.4와 동일 형태 · 삭제는 `204` (첨부 R2 객체까지 제거)

---

## 4. 첨부파일 (`/api/attachments`, `/api/files`)

### 4.1 `POST /api/attachments` — 업로드
권한 `L` · `multipart/form-data` (`file`)
```json
// 201
{ "data": { "id": "7", "filename": "신청서.xlsx", "sizeBytes": 24576 } }
```
게시물 저장 시 `attachmentIds`로 연결합니다. 연결되지 않은 첨부는 24시간 후 정리됩니다.

### 4.2 `GET /api/files/{attachmentId}` — 다운로드
권한 **게시물 권한 상속**(→ `BUDGET` 첨부만 `L`, 나머지는 `G`) · **302** → presigned URL (10분)
파일 주소를 아는 것만으로 열려서는 안 됩니다 — **첨부 id로 요청이 올 때마다 원글의 분류를 다시 확인합니다.**
⚠️ **아래 서술은 2026-09-04에 정정했습니다.** 「대부분의 첨부는 익명도 받을 수 있고 `BUDGET` 첨부만 `L`↑」는 사진첩·주보와 같은 **공개 열람 시절의 서술**이었습니다. 2026-08-31 「열람 M 복귀」 이후 §10 매트릭스가 기준입니다:

| 원글 분류 | 권한 |
|---|---|
| 공개공지 | `G` |
| 내부공지 · 회의록 | `M` |
| 예산안 | `L` |

권한이 없으면 원글과 마찬가지로 **`404`** 를 줍니다(존재를 숨김).

★ **BE는 이 규칙을 첨부 쪽에 다시 쓰지 않습니다.** `PostQueryService`의 단일 관문을 그대로 부릅니다 — 같은 규칙이 두 곳에 있으면 언젠가 어긋나고, 그러면 예산안 첨부가 회의록 규칙으로 열립니다.

✅ **2026-09-04 구현.** 그전까지 FE는 링크를 걸어두었지만 눌러도 열리지 않았습니다 (`SPEC_FUNCTIONAL` FR-DOC-05).

---

## 5. 주보 (`/api/bulletins`)

### 5.1 `GET /api/bulletins/latest`
권한 `M` — ⚠️ **2026-09-04에 `G`에서 올렸습니다.** 비로그인은 `401`입니다.
```json
{
  "data": {
    "id": "12",
    "serviceDate": "2026-08-24",
    "pages": [
      { "pageNo": 1, "url": "https://r2.../view.webp?X-Amz-...", "width": 1448, "height": 2048 },
      { "pageNo": 2, "url": "https://r2.../view.webp?X-Amz-...", "width": 1448, "height": 2048 }
    ]
  }
}
```
⚠️ 주보는 글자가 작아 **큰 이미지(장변 2048px)를 바로 제공**합니다. 썸네일을 먼저 주는 사진첩과 로딩 전략이 반대입니다.
주보가 없으면 `{ "data": null }`.

### 5.2 `GET /api/bulletins?page=&size=`
권한 `M`
```json
{
  "data": {
    "items": [
      { "id": "12", "serviceDate": "2026-08-24", "pageCount": 2, "thumbUrl": "https://r2.../thumb.webp?..." }
    ],
    "page": 0, "size": 20, "hasNext": true
  }
}
```

### 5.3 `GET /api/bulletins/{id}` — 5.1과 동일 형태 (권한 `M`)

### 5.4 `POST /api/bulletins`
권한 `L` · `multipart/form-data`

| 파트 | 설명 |
|---|---|
| `serviceDate` | `2026-08-24` |
| `pages[]` | 이미지 파일 N개 (**순서 = 페이지 순서**) |

`201 { "data": { "id": "12", "pageCount": 2 } }`
| 실패 | code |
|---|---|
| 같은 날짜 존재 | `DUPLICATE` (교체 여부를 FE가 확인 후 재요청) |
| 용량 초과 | `STORAGE_LIMIT` |

### 5.5 `DELETE /api/bulletins/{id}`
권한 `L` · `204` · R2 객체까지 삭제

### 5.6 `GET /api/bulletins/{id}/pages/{pageNo}/download` — 장별 내려받기
권한 `M` · **302** → presigned URL

⚠️ **원래 이 문서에 없던 경로입니다.** `FR-BUL-04`가 장별 다운로드를 요구하는데 §5에 경로가 없어, FE가 `types.ts`에 `[CONTRACT]`로 제안한 것을 그대로 채택했습니다 (2026-09-04).

★ **`§5.1`의 `pages[].url`과 다른 값입니다.** 그쪽은 열람용이라 `Content-Disposition`이 없어 브라우저가 탭에서 열어버립니다. 이 경로는 R2에 `attachment`를 지시해 저장되게 하고, 파일명도 `2026-08-24-1쪽.webp` 형태로 지정합니다.

---

## 6. 사진첩 (`/api/albums`, `/api/photos`, `/api/uploads`)

### 6.1 `GET /api/albums?page=&size=`
권한 `M` — ⚠️ **2026-08-31 「열람 M 복귀」 반영.** 이 표기가 그때 갱신되지 않아 §10 매트릭스(401)와 어긋나 있었다.
```json
{
  "data": {
    "items": [
      {
        "id": "5", "title": "2026 여름수련회", "eventDate": "2026-08-01",
        "photoCount": 243,
        "coverThumbUrl": "https://r2.../thumb.webp?X-Amz-..."
      }
    ],
    "page": 0, "size": 20, "hasNext": false
  }
}
```

### 6.2 `POST /api/albums`
권한 `L` · 요청 `{ "title": "2026 여름수련회", "eventDate": "2026-08-01" }` · `201 { "data": { "id": "5" } }`

### 6.3 `DELETE /api/albums/{id}`
권한 `L` · `204` · ⚠️ **사진과 R2 객체를 모두 삭제**합니다 (고아 객체 방지)

### 6.4 `GET /api/albums/{id}/photos?cursor=&size=`
권한 `M` · 커서 페이징 (수백 장 스크롤)
```json
{
  "data": {
    "items": [
      {
        "id": "901",
        "thumbUrl": "https://r2.../thumb.webp?X-Amz-...",
        "viewUrl": "https://r2.../view.webp?X-Amz-...",
        "width": 2560, "height": 1707,
        "takenAt": "2026-08-01T05:22:10Z"
      }
    ],
    "nextCursor": "eyJpZCI6OTIxfQ",
    "hasNext": true
  }
}
```
- 그리드는 `thumbUrl`(640px, ~80KB)만 사용합니다. 200장 열람 시 전송량 약 16MB
- `viewUrl`(2560px)은 확대·다운로드용
- `status = COMMITTED`인 사진만 반환합니다

### 6.5 `POST /api/uploads:issue` — 업로드 URL 발급
권한 `L`
```json
// 요청
{
  "albumId": "5",
  "files": [
    { "clientId": "f1", "sizeBytes": 1250000, "thumbSizeBytes": 82000, "width": 2560, "height": 1707, "takenAt": "2026-08-01T05:22:10Z" },
    { "clientId": "f2", "sizeBytes": 1180000, "thumbSizeBytes": 79000, "width": 2560, "height": 1440, "takenAt": null }
  ]
}
```
```json
// 200
{
  "data": {
    "uploads": [
      {
        "clientId": "f1", "photoId": "901",
        "viewPutUrl": "https://r2.../view.webp?X-Amz-...",
        "thumbPutUrl": "https://r2.../thumb.webp?X-Amz-...",
        "expiresIn": 900
      }
    ]
  }
}
```
- presigned PUT URL **유효 15분**. 200장은 배치로 나눠 재발급
- `photos` 행이 `status=PENDING`으로 생성됩니다
- 재시도는 **같은 `photoId`로 재발급**합니다 (고아 방지)
- 파일은 **브라우저 → R2 직접 전송**. 백엔드를 통과하지 않습니다

| 실패 | code |
|---|---|
| 용량 95% 초과 | `STORAGE_LIMIT` |

### 6.6 `POST /api/uploads:commit` — 업로드 확정
권한 `L` · **20장 배치** (200회 호출은 낭비)
```json
// 요청
{ "photoIds": ["901", "902", "903"] }
```
```json
// 200
{ "data": { "committed": ["901", "902"], "failed": [{ "photoId": "903", "reason": "OBJECT_NOT_FOUND" }] } }
```
`status=COMMITTED`로 전환하고 `size_bytes`를 기록합니다. 미커밋 `PENDING`은 24시간 후 정리됩니다.

### 6.7 `GET /api/photos/{id}/download`
권한 `M` · **302** → presigned URL

### 6.8 ~~`GET /api/albums/{id}/download?ids=901,902,903`~~ — ❌ **폐기 (구현하지 마세요)**

**PM 결정 2026-08-25로 기능 자체를 없앴습니다.** 사진첩이 공개 열람으로 바뀌면서
**"앨범을 통째로 받아가는 경로"를 남기지 않기로** 했습니다 — 보는 것과 대량으로
받아가는 것은 다른 문제라는 판단입니다.

- 개별 다운로드(`§6.7`)는 그대로 유지됩니다. 한 장씩은 익명도 받을 수 있습니다
- FE는 선택 모드·하단 액션 바·API 호출을 전부 제거했습니다 — **이 엔드포인트를 호출하지 않습니다**
- 이미 작업했다면 되돌려도 되고, 두고 라우팅만 빼도 됩니다
- 근거: `handoff/2026-08-25-public-read-model.md §1` · `SPEC_FUNCTIONAL` FR-PHO-05

### 6.9 `DELETE /api/photos/{id}`
권한 `L` · `204` · R2 객체까지 삭제

### 6.10 `POST /api/photos/{id}/report` — 신고·삭제 요청
권한 `M` · 요청 `{ "reason": "본인 사진 삭제 요청합니다" }` · `204` · 임원에게 전달 (초상권 대응)

⚠️ **2026-09-04에 `G`(익명 허용)에서 `M`으로 확정했습니다.** 이전 서술은 사진첩이 공개 열람이던 시절의 것입니다.

결정적인 이유는 권한 일관성이 아니라 **`G`가 동작하지 않는다**는 것입니다 — 이 요청에는 사진 `{id}`가 필요한데, 익명은 앨범 목록도 사진 목록도 `401`이라 **id를 알아낼 경로가 없습니다.** 열어두면 아무도 제대로 쓸 수 없는 창구를 만들고 스팸만 받습니다.

⚠️ **비회원이 자기 사진 삭제를 요청할 창구는 사이트에 없습니다.** 교회 연락처 등 사이트 밖 경로로 받아야 합니다 — 없다는 것을 알고 가는 것과 모르고 가는 것은 다릅니다.

---

### 6.11 오래된 앨범 정리 — R2 용량 회수
권한 **`T`(전도사)** · `FR-PHO-11`

**⚠️ 사진첩 안에서 권한이 갈리는 유일한 지점입니다.** 열람은 `M`, 앨범 생성·삭제는 `L`인데 **정리만 `T`** 입니다. 임원이 못 하는 일을 막는 것이 아니라(임원은 `§6.3`으로 하나씩 지울 수 있습니다) **한 번의 호출로 여러 앨범이 되돌릴 수 없이 사라지는 창구**를 좁힌 것입니다.

> 원래 `FR-PHO-11`은 "내려받아 외부 보관 후 제거"였습니다. 사진첩이 **홍보용**이고 "외부 보관" 위치가 정해진 적이 없어 **보관 없이 삭제**로 바꿨습니다 (`DECISIONS.md` 2026-09-10).

#### `GET /api/admin/albums/purge-candidates?count=`
`count` 기본 5 · 최대 20. **아무것도 지우지 않습니다.**

```json
{
  "data": [
    { "id": "5", "title": "2023 여름수련회", "eventDate": "2023-08-01",
      "photoCount": 243, "sizeBytes": 322961408 }
  ]
}
```

★ **응답의 `id`들을 그대로 아래 `albumIds`에 넣으세요.**

⚠️ **`eventDate`가 없는 앨범은 나오지 않습니다.** 언제 찍은 것인지 모르는 앨범을 "오래됐다"고 판단할 근거가 없습니다. 그런 앨범은 `§6.3`으로 직접 지정하세요.

⚠️ 정렬 기준은 **행사일**입니다(업로드일이 아닙니다). 작년 행사를 올해 뒤늦게 올린 앨범이 "최신"으로 잡히면 안 됩니다.

`sizeBytes`는 **커밋된 사진**의 합계입니다. 커밋되지 않은 사진은 `size_bytes`가 0이라 여기 안 잡히지만, 삭제할 때 그 R2 객체도 함께 지워집니다.

#### `POST /api/admin/albums/purge`
요청 `{ "albumIds": ["5", "7"] }` · 응답 `{ "data": { "deletedAlbums": 2, "deletedPhotos": 312, "freedBytes": 414187520 } }`

★ **개수가 아니라 id 목록을 받습니다.** "오래된 3개를 지워라"로 받으면 미리보기와 실행 사이에 더 오래된 행사일의 앨범이 생겼을 때 **화면에서 본 것과 다른 앨범이 지워집니다.**

| 실패 | code |
|---|---|
| 빈 목록 | `VALIDATION_ERROR` |
| 없는 `albumIds`가 섞임 | `NOT_FOUND` — **전체가 실패합니다** |

⚠️ **되돌릴 수 없습니다.** 원본을 보관하지 않으므로 복구 경로가 없습니다. 확인 다이얼로그 없이 부르지 마세요.

⚠️ 없는 id에서 전체를 실패시키는 이유는 **일부만 지워진 상태로 끝나는 것보다 아무것도 지우지 않는 편이 낫기** 때문입니다.

> **지금은 수동입니다.** 자동 배치(`@Scheduled`)를 붙이지 않았습니다 — 예고 없이 사라지면 아무도 언제 무엇이 지워졌는지 모르고, Render 무료 인스턴스는 유휴 시 잠들어 주기를 지키지도 못합니다. 필요해지면 이 서비스에 스케줄을 얹으면 됩니다.

---

## 7. 월례회 (`/api/meetings`)

⚠️ 이 리소스는 **presigned URL을 발급하지 않습니다.** 발급하면 기간 종료 후에도 URL이 만료 전까지 살아있고 공유 가능해집니다. **서버가 직접 스트리밍합니다.**

### 7.1 `GET /api/meetings?page=&size=`
권한 `M`
```json
{
  "data": {
    "items": [
      {
        "id": "3", "title": "2026년 8월 월례회", "meetingDate": "2026-08-24",
        "pageCount": 10,
        "viewableFrom": "2026-08-24T11:00:00Z",
        "viewableUntil": "2026-08-26T14:59:00Z",
        "status": "OPEN"
      },
      {
        "id": "2", "title": "2026년 6월 월례회", "meetingDate": "2026-06-22",
        "pageCount": 8,
        "viewableFrom": "2026-06-22T11:00:00Z",
        "viewableUntil": "2026-06-24T14:59:00Z",
        "status": "CLOSED"
      }
    ],
    "page": 0, "size": 20, "hasNext": false
  }
}
```
| `status` | 의미 |
|---|---|
| `SCHEDULED` | 열람 시작 전 |
| `OPEN` | 열람 가능 |
| `CLOSED` | **기간 종료 — 열람 불가** |

- 종료된 자료도 목록에는 **남습니다**(존재는 알리되 내용은 차단)
- `L` 이상은 `status`와 무관하게 열람 가능합니다 — 자료를 올리고 관리하는 쪽이라
  기간이 끝난 뒤에도 확인해야 합니다

### 7.2 `GET /api/meetings/{id}`
권한 `M` — `canView`는 **요청한 사람 기준**입니다. 같은 자료라도 회원과 임원의 값이 다릅니다
```json
{
  "data": {
    "id": "3", "title": "2026년 8월 월례회", "meetingDate": "2026-08-24",
    "pageCount": 10, "status": "OPEN",
    "viewableUntil": "2026-08-26T14:59:00Z",
    "remainingSeconds": 183540,
    "canView": true,
    "viewReason": null
  }
}
```
| 실패 | code | 상황 |
|---|---|---|
| 기간 외 (`M`) | `FORBIDDEN` | `viewReason: "PERIOD_CLOSED"` 로 안내 |

### 7.3 `GET /api/meetings/{id}/pages/{pageNo}` ★
권한 `M`

**응답: 이미지 바이너리** (`image/jpeg`)

⚠️ **2026-09-04에 `image/webp`에서 바꿨습니다.** Java `ImageIO`가 WebP 쓰기를 지원하지 않아 네이티브 라이브러리가 필요한데, Render에서 깨지기 쉽습니다. 워터마크가 합성된 페이지는 원본 화질이 목적이 아니라 JPEG로 충분합니다.

| 헤더 | 값 |
|---|---|
| `Cache-Control` | `no-store, no-cache, must-revalidate` |
| `Content-Disposition` | `inline` |

처리 순서:
1. 인증·역할 확인 (회원 이상)
2. **`L`↑이 아니면** 열람 기간 검사 → 기간 외 **403**
3. R2에서 원본 페이지 읽기
4. **워터마크 합성** — `{이름} {연락처 뒷4자리}` + 열람시각 + 문서ID
5. 스트리밍 응답
6. `meeting_doc_views` 기록

⚠️ **2026-09-04에 익명 열람을 접었습니다.** 위 세 절의 `권한 G`와 아래에 있던
「익명 워터마크(`익명 열람`)」 분기는 **공개 열람 시절의 서술**이었습니다. 근거 셋:

- **§10 인가 매트릭스가 이미 `401`** (`GET /meetings`·`pages/{n}`)
- **FE가 두 화면을 `MemberGate`로 막아둠** — 그 분기에 도달할 수 없음
- **`meeting_doc_views.member_id`가 `NOT NULL`** — 익명 열람은 위 6번(열람 기록)을
  **수행할 수 없음.** 유출 추적이 목적인 기능에서 "워터마크는 박히는데 누가 언제
  봤는지는 안 남는" 상태가 됨

⚠️ **FE 뷰어 하단 문구에 익명 분기가 아직 남아 있습니다** (`"로그인해서 열람하면
이름과 연락처 뒷자리도 함께 인쇄됩니다"`). `MemberGate` 뒤라 도달하지 않지만,
**문구와 실제가 어긋나면 사용자에게 거짓말이 됩니다** — 정리가 필요합니다.

⚠️ **화면 캡처는 막을 수 없습니다** (`ARCHITECTURE.md §7.7`). 워터마크는 캡처를
막는 장치가 아니라, 막을 수 없어서 넣은 **추적 장치**입니다.

⚠️ 응답에 **R2 키나 presigned URL이 포함되어서는 안 됩니다.**

### 7.4 `POST /api/meetings`
권한 `L` · `multipart/form-data`

| 파트 | 설명 |
|---|---|
| `title` | `2026년 8월 월례회` |
| `meetingDate` | `2026-08-24` |
| `viewableFrom` | `2026-08-24T11:00:00Z` |
| `viewableUntil` | `2026-08-26T14:59:00Z` |
| `file` | **PDF** (Word에서 「PDF로 저장」한 파일) |

```json
// 201
{ "data": { "id": "3", "pageCount": 10 } }
```
- 서버가 PDFBox로 페이지 이미지(장변 2048px)로 변환합니다
- 동기 처리입니다. FE는 진행 상태를 표시합니다
- ⏱️ **실측 (2026-09-04)**: 텍스트 위주 A4 10쪽 = **약 1.1초** (쪽당 ~110ms), 생성 이미지 쪽당 약 550KB. 문서에 적혀 있던 「15~30초」보다 훨씬 빠릅니다.
  ⚠️ 다만 **합성 PDF로 잰 값이라 하한**입니다 — 이미지·표·한글 임베드 폰트가 든 실제 월례회 자료는 더 걸립니다. 첫 실운영 업로드에서 다시 재보세요.
  ⚠️ 힙 사용이 10쪽에 약 160MB 늘었습니다. Render 무료 인스턴스가 `-Xmx400m`라 **쪽수가 많은 자료는 여유가 크지 않습니다** — 상한을 50쪽으로 두었습니다.
- **업로드한 PDF 원본은 보관하지 않습니다** — 남으면 유출 경로가 됩니다
- 페이지 순서는 PDF 순서를 따릅니다

| 실패 | code |
|---|---|
| PDF 아님·암호화·손상 | `VALIDATION_ERROR` (field: `file`) |
| `viewableUntil` ≤ `viewableFrom` | `VALIDATION_ERROR` |
| 용량 초과 | `STORAGE_LIMIT` |

### 7.5 `PATCH /api/meetings/{id}/window`
권한 `L` · 요청 `{ "viewableFrom": "...", "viewableUntil": "..." }` · 연장·조기 종료

### 7.6 `DELETE /api/meetings/{id}`
권한 `L` · `204` · 페이지 이미지까지 삭제

### 7.7 `GET /api/meetings/{id}/views`
권한 `L`
```json
{
  "data": {
    "totalViewers": 34,
    "items": [
      { "memberName": "김OO", "village": "3", "lastViewedAt": "2026-08-24T12:03:00Z", "maxPageNo": 10 }
    ],
    "page": 0, "size": 20, "hasNext": true
  }
}
```
유출 발생 시 워터마크와 대조하는 근거입니다.

---

## 8. 관리 (`/api/admin`)

### 8.1 `GET /api/admin/members?q=&page=&size=`
권한 **`T`**
```json
{
  "data": {
    "items": [
      {
        "id": "51", "name": "이도연a", "loginId": "doyeon01",
        "phone": "010-1234-5678", "role": "MEMBER",
        "createdAt": "2026-08-19T09:00:00Z"
      }
    ],
    "page": 0, "size": 20, "hasNext": false
  }
}
```
`q`: 이름 검색. ~~`status` 파라미터~~ 폐기 — PENDING이 없으므로 전체 목록 하나뿐입니다.
`loginId`는 카카오 가입자면 `null`. 이름은 명단의 **동명이인 접미사를 포함해 그대로** 표시합니다.
❓ 마을 컬럼은 명단 DB에 마을 정보가 확인되면 추가 논의 (인증에는 불필요).

### 8.2 `DELETE /api/admin/members/{id}` — 계정 삭제 + 명단 재개방
권한 **`T`** · 요청 `{ "reason": "본인 확인 — 선점 계정 삭제" }` · `204`

계정 삭제 + 명단 `claimed_at` 해제 + 감사로그(사유 필수).
**선점 복구 절차의 핵심입니다**: 진짜 본인이 "이미 계정이 있습니다"를 만나면 →
전도사가 명단의 전화번호로 본인 확인 → 이 API로 삭제 → 본인이 다시 가입.
~~구 `POST .../approve`(승인) · `POST .../reject`(거절)~~ 폐기 — 승인 절차가 없습니다.

### 8.3 `PATCH /api/admin/members/{id}/role`
권한 **`T`** · 요청 `{ "role": "LEADER" }` · `204`

| 실패 | code | 상황 |
|---|---|---|
| 마지막 `PASTOR` 강등 | `VALIDATION_ERROR` | 회원 관리가 불가능해지는 것을 방지 |

### 8.4 `POST /api/admin/members/{id}/password/reset` — 리셋 코드 발급
권한 **`T`**
```json
// 200
{ "data": { "resetCode": "8H2K-9QX1", "expiresAt": "2026-08-31T12:30:00Z" } }
```
코드는 **1회용 · 30분 · 해시 저장**. 화면에 표시된 코드를 전도사가 구두/문자로 전달하고,
본인이 `§2.9 reset-with-code`로 새 비밀번호를 설정합니다. 발급도 감사로그에 남깁니다.

### 8.5 `GET /api/admin/storage`
권한 `L`
```json
{
  "data": {
    "usedBytes": 4509715660,
    "limitBytes": 10737418240,
    "usagePercent": 42.0,
    "photoCount": 3100,
    "estimatedRemainingPhotos": 4300,
    "warningThreshold": 80,
    "blockThreshold": 95,
    "uploadBlocked": false
  }
}
```
⚠️ 비용 $0이 제약이므로 **95% 도달 시 업로드를 차단**합니다.

### 8.6 `GET /api/admin/newcomers?page=&size=`
권한 `L`
```json
{
  "data": {
    "items": [
      {
        "id": "14", "name": "김OO", "phone": "010-1234-5678",
        "gender": "MALE", "ageGroup": "EARLY_20S", "referrer": "FRIEND",
        "message": "친구 소개로 가보려고요",
        "createdAt": "2026-08-19T10:22:00Z"
      }
    ],
    "page": 0, "size": 20, "hasNext": false
  }
}
```
개인정보이므로 **보유기간 1년** 후 삭제합니다.

✅ **2026-09-04 구현.** 서버가 하루 한 번 돌며 1년 지난 신청을 지웁니다 (`NewcomerAdminService.purgeExpired`). 그전까지는 문서에만 있는 규칙이었고 지우는 코드가 없었습니다 — 계속 보관해야 하는 내용은 임원이 따로 옮겨 두어야 합니다.

---

## 9. 공개 (`/api/newcomers`, `/api/sermons`)

### 9.1 `POST /api/newcomers`
권한 `G`
```json
{
  "name": "김OO",
  "phone": "010-1234-5678",
  "gender": "MALE",
  "ageGroup": "EARLY_20S",
  "referrer": "FRIEND",
  "message": "친구 소개로 가보려고요",
  "agreed": true,
  "honeypot": ""
}
```
| 필드 | 필수 | 값 |
|---|---|---|
| `name` `phone` | ✅ | |
| `gender` | — | `MALE` \| `FEMALE` |
| `ageGroup` | — | `EARLY_20S` \| `LATE_20S` \| `EARLY_30S` \| `LATE_30S` |
| `referrer` | — | `FRIEND` \| `SEARCH` \| `SNS` \| `ETC` |
| `agreed` | ✅ | **`true`가 아니면 거부** |
| `honeypot` | — | 값이 있으면 봇 → 조용히 `204` |

`201 { "data": { "id": "14" } }`
- 동일 IP **5분 5회** 초과 시 거부
- ~~성공 시 담당자에게 알림 메일~~ → **웹 알림으로 대체** (`[CONTRACT]`, 2026-09-09)

> ⚠️ **알림 메일은 몇 달간 실제로 아무에게도 가지 않았습니다.** 발신 도메인·SPF·
> 수신자 명단이 정해지지 않아 `NewcomerNotifier` 구현체가 `id`만 로그로 남기는
> 상태였습니다. 즉 새가족 신청을 알려면 누군가 `§8.6` 목록을 열어봐야 했고,
> **열어볼 이유가 없으면 열지 않았습니다.**
>
> `§14`(전도사·임원 알림)가 이 자리를 메웁니다 — 이미 로그인해 있는 사람에게
> 띄우는 방식이라 도메인도 수신자 명단도 필요 없습니다. 메일은 폐기가 아니라
> **보류**입니다: 발신 도메인이 정해지면 `NewcomerNotifier`에 구현체를 끼웁니다.

### 9.2 `GET /api/sermons?page=&size=` — 설교 영상 목록
권한 `G` · 🙏 **신규 계약** (`[CONTRACT]`, FE PR #70 · `BACKEND_HANDOFF.md` 2026-08-25)

**BE가 YouTube Data API를 프록시합니다.** 브라우저가 YouTube를 직접 부르지 않습니다 —
**API 키를 클라이언트에 실을 수 없기 때문입니다.** `NEXT_PUBLIC_`으로 넣으면 번들에
그대로 박히고(`NFR-SEC-22`), 키가 유출되면 쿼터를 남이 씁니다.

```json
{
  "data": {
    "items": [
      {
        "id": "dQw4w9WgXcQ",
        "title": "오늘, 다시 시작하는 믿음",
        "publishedAt": "2026-08-16T05:00:00Z",
        "youtubeUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "thumbnailUrl": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
      }
    ],
    "page": 0, "size": 12, "hasNext": true
  }
}
```

- **최신순**으로 주세요 — 화면이 정렬하지 않습니다
- `id`는 목록 키로만 씁니다. YouTube 영상 id를 그대로 쓰면 됩니다
- `thumbnailUrl`은 YouTube CDN 주소를 그대로 넘기세요. FE가 `<img>`로 직접 로드하고,
  **404가 오면 자리표시자로 넘어갑니다**(영상이 비공개로 바뀌는 경우)
- `publishedAt`은 ISO-8601 UTC

**BE가 정해야 할 것 3가지**
1. **응답 캐시 기간** — YouTube API 쿼터가 하루 10,000 units, 목록 조회 1회당 약 100
   units입니다. 캐시하지 않으면 방문자가 늘 때 쿼터가 빠르게 소진됩니다.
   설교는 주 1회 올라가므로 **수 시간 캐시가 안전합니다**
2. **채널 id vs 재생목록 id** — 재생목록이면 "설교"만 골라 담을 수 있어 잡영상이
   섞이지 않습니다 (`PLAN §8`의 ❓ "YouTube 재생목록 구성"과 연결 — **PM 확인 필요**)
3. **YouTube 실패 시 응답** — 빈 목록(`items: []`)을 줄지 `502`를 줄지.
   **FE는 둘 다 처리합니다**(빈 목록이면 "아직 등록된 영상이 없습니다")

> ⚠️ **2026-09-01 — 화면이 이 목록을 `size=4`로만 씁니다.** `/sermons`가
> 라이브 우선 화면으로 바뀌면서 무한 스크롤을 걷어냈습니다(`DECISIONS.md`
> 2026-09-01). 페이지네이션 계약은 그대로 두니 서버는 바꿀 것이 없습니다.

### 9.3 `GET /api/sermons/live` — 진행 중인 라이브
권한 `G` · 🙏 **신규 계약** (`[CONTRACT]`, 2026-09-01 · `BACKEND_HANDOFF.md`)

주일 청년예배가 **일요일 13:45 무렵** 라이브로 올라옵니다. 방송이 켜져 있으면
`/sermons` 맨 위가 "지난 영상 4편"에서 **라이브 재생 화면**으로 바뀝니다.
§9.2와 같은 이유로 **BE가 YouTube Data API를 프록시해서 판정합니다.**

**방송 중 (200)**

```json
{
  "data": {
    "videoId": "SaVEqB82v7Y",
    "title": "2026년 9월 7일 주일 청년예배",
    "startedAt": "2026-09-07T04:45:00Z",
    "watchUrl": "https://www.youtube.com/watch?v=SaVEqB82v7Y",
    "thumbnailUrl": "https://i.ytimg.com/vi/SaVEqB82v7Y/hqdefault.jpg"
  }
}
```

**방송 중이 아님 (200)** — `{ "data": null }`

- ⚠️ **`null`로 주세요.** 빈 객체나 `live: false` 플래그를 쓰면 화면 분기가
  둘로 갈립니다. **404도 쓰지 마세요** — "방송이 없다"는 정상 상태입니다
- ⚠️ **캐시 TTL은 60초를 넘기지 마세요.** 화면이 60초마다 다시 물어봅니다
  (`LiveSection.tsx`). TTL이 더 길면 방송 시작이 그만큼 늦게 반영됩니다.
  쿼터 때문에 캐시는 필요하지만 **60초가 상한**입니다
- ⚠️ **요일로 필터링하지 마세요.** 특별집회 등 다른 요일 방송도 그대로 떠야
  합니다. "지금 라이브인가"만 판정하면 됩니다
- `videoId`는 11자 YouTube 영상 id입니다 — FE가 임베드 주소
  (`youtube-nocookie.com/embed/<id>`)를 만듭니다
- `startedAt`은 ISO-8601 UTC (실제 방송 시작 시각)

---

## 10. 인가 매트릭스 (테스트 기준)

⚠️ **RLS가 없으므로 이 표가 마지막 방어선입니다.** 자동 테스트로 검증하고 CI에서 실행합니다.

> ⚠️ **2026-08-31 교체 — 로그인·권한 재설계 확정 반영.** `P`(승인 대기) 열은
> 역할 자체가 소멸해 제거했습니다. **굵은 칸이 2026-08-25 값에서 바뀐 지점**입니다.
> 근거: `handoff/2026-08-28-auth-roster-model.md` §3 + §9 확정.

| 엔드포인트 | G | M | L | T |
|---|---|---|---|---|
| `POST /auth/verify-roster` · `POST /auth/register` · `POST /auth/password/reset-with-code` | 200 | 200 | 200 | 200 |
| `POST /auth/login` · `POST /auth/refresh` | 200 | 200 | 200 | 200 |
| `POST /auth/logout` | **204** | 204 | 204 | 204 |
| `GET /auth/me` | **401** | 200 | 200 | 200 |
| `PATCH /auth/me` · `POST /auth/password/change` | **401** | 200 | 200 | 200 |
| `DELETE /auth/me` | **401** | 204 | 204 | 204 |
| `GET /auth/kakao/authorize` · `GET /auth/kakao/callback` | **302** | 302 | 302 | 302 |
| `GET /posts?category=NOTICE_PUBLIC` | 200 | 200 | 200 | 200 |
| `GET /posts?category=NOTICE_MEMBER` | **401** | 200 | 200 | 200 |
| `GET /posts?category=MINUTES` | **401** | 200 | 200 | 200 |
| `GET /posts?category=BUDGET` | 403 | 403 | 200 | 200 |
| `GET /posts/{공개공지id}` | 200 | 200 | 200 | 200 |
| `GET /posts/{내부공지·회의록id}` | **401** | 200 | 200 | 200 |
| `GET /posts/{예산안id}` | 404 | 404 | 200 | 200 |
| `POST /posts` | 401 | 403 | 200 | 200 |
| `POST /attachments` (§4.1) | 401 | 403 | 201 | 201 |
| `GET /files/{공개글첨부id}` | 200 | 200 | 200 | 200 |
| `GET /files/{내부공지·회의록 첨부id}` | **401** | 200 | 200 | 200 |
| `GET /files/{예산안첨부id}` | 404 | 404 | 200 | 200 |
| `GET /bulletins/latest` | **401** | 200 | 200 | 200 |
| `GET /bulletins` | **401** | 200 | 200 | 200 |
| `GET /bulletins/{id}` | **401** | 200 | 200 | 200 |
| `POST /bulletins` | 401 | 403 | 200 | 200 |
| `GET /bulletins/{id}/pages/{n}/download` (§5.6) | **401** | 302 | 302 | 302 |
| `DELETE /bulletins/{id}` | 401 | 403 | 204 | 204 |
| `GET /albums` | **401** | 200 | 200 | 200 |
| `GET /albums/{id}/photos` | **401** | 200 | 200 | 200 |
| `GET /photos/{id}/download` | **401** | 200 | 200 | 200 |
| `POST /photos/{id}/report` | **401** | 200 | 200 | 200 |
| `POST /albums` | 401 | 403 | 201 | 201 |
| `DELETE /albums/{id}` | 401 | 403 | 204 | 204 |
| `POST /uploads:issue` | 401 | 403 | 200 | 200 |
| `POST /uploads:commit` | 401 | 403 | 200 | 200 |
| `DELETE /photos/{id}` | 401 | 403 | 200 | 200 |
| `GET /meetings` | **401** | 200 | 200 | 200 |
| `GET /meetings/{id}` | **401** | 200 | 200 | 200 |
| `GET /meetings/{id}/pages/{n}` (기간 내) | **401** | 200 | 200 | 200 |
| `GET /meetings/{id}/pages/{n}` (**기간 외**) | 401 | 403 | 200 | 200 |
| `POST /meetings` | 401 | 403 | 200 | 200 |
| `GET /meetings/{id}/views` | 401 | 403 | 200 | 200 |
| `GET /admin/storage` | 401 | 403 | 200 | 200 |
| `GET /admin/newcomers` | 401 | 403 | 200 | 200 |
| `GET /admin/notifications` (§14) | 401 | 403 | 200 | 200 |
| `POST /admin/notifications/read` (§14) | 401 | 403 | 200 | 200 |
| `GET /admin/members` | 401 | 403 | **403** | 200 |
| `DELETE /admin/members/{id}` | 401 | 403 | **403** | 200 |
| `PATCH /admin/members/{id}/role` | 401 | 403 | **403** | 200 |
| `POST /admin/members/{id}/password/reset` | 401 | 403 | **403** | 200 |
| `POST /newcomers` | 200 | 200 | 200 | 200 |
| `GET /sermons` | 200 | 200 | 200 | 200 |
| `GET /sermons/live` | 200 | 200 | 200 | 200 |
| `GET /attendance/sessions` (§13) | 401 | 403 | 200 | 200 |
| `POST /attendance/sessions` | 401 | 403 | 200 | 200 |
| `GET /attendance/sessions/{id}` | 401 | 403 | 200 | 200 |
| `PUT /attendance/sessions/{id}/entries` | 401 | 403 | 200 | 200 |
| `DELETE /attendance/sessions/{id}` | 401 | 403 | 200 | 200 |

엔드포인트를 추가하면 이 표에 행을 추가합니다. **표에 없는 보호 엔드포인트는 미완성으로 봅니다.**

### 이 표를 읽을 때 틀리기 쉬운 4가지

1. **비공개 열람의 `G`는 `403`이 아니라 `401`입니다.** 내부공지·회의록·사진첩·월례회는
   "로그인하면 볼 수 있는" 콘텐츠입니다 — 익명에게 `403`을 주면 FE가 로그인 유도를
   할 수 없습니다
2. **`403`과 `404`를 섞지 마세요.** 예산안 **상세·첨부**는 `404`(존재를 숨김),
   예산안 **목록 조회**는 `403`(분류의 존재는 이미 공개된 정보)입니다
3. **`G`는 `401`, 로그인했지만 미달은 `403`입니다.** 익명은 "로그인하면 될 수도
   있다"이고, 로그인한 회원은 "로그인해도 안 된다"입니다 — FE가 이 둘을
   다르게 처리합니다(로그인 유도 화면 vs 권한 없음 안내)
4. **월례회 기간 외 `403`은 로그인 여부와 무관합니다.** `L`↑만 통과하고,
   그 우회는 **세션이 있을 때만** 적용됩니다 (`§7.1` `§7.2`)
5. **`POST /auth/logout`은 비로그인도 `204`입니다.** `§2.5`는 "권한 로그인"이라
   적었지만 구현은 열어 뒀습니다 — 쿠키가 이미 만료된 사용자가 로그아웃조차 할 수
   없게 되는 막다른 길을 막기 위해서입니다. 로그아웃은 실패할 이유가 없는 동작이고,
   열어 두어 새는 정보도 없습니다 (2026-09-01 BE 확정)

⚠️ **사진첩이 `M`이 되면서 presigned URL이 새는 경로가 됩니다.** `GET /albums/{id}/photos`가
발급하는 URL 자체에는 인증이 없으므로 **만료를 짧게(10분 이하)** 가져가고, `§6.7` 개별
다운로드는 매 요청마다 세션을 다시 봅니다 (브리핑 §3 경고).

---

## 11. 마일스톤별 구현 순서

| M | 엔드포인트 |
|---|---|
| **M1** | `GET /posts`(공개만) · `GET /posts/{slug}` · `POST /newcomers` · `GET /sermons` |
| **M2** | `/auth/*` 전체 · `POST/PUT/DELETE /posts` · `/admin/members/*` |
| **M3** | `/bulletins/*` · `/albums/*` · `/photos/*` · `/uploads:*` · `/admin/storage` |
| **M4** | `/meetings/*` · `/attachments` · `/files/{id}` · `/admin/newcomers` · `/photos/{id}/report` |
| **M4+** | `/admin/notifications` (§14) — `§9.1`의 알림 메일을 대체한다. 구현 완료 |
| **M2 이후** | `/attendance/*` (§13) — `member_roster`에 의존해 인증 재설계(M2) 뒤로 밀렸다. 구현 완료 |

---

## 12. FE 연동 참고

### 12.1 mock 계층
BE 구현 전에도 화면을 완성할 수 있게 mock을 둡니다.
```
frontend/src/lib/api/
├─ index.ts    # FE는 항상 이것만 import
├─ mock.ts     # 이 문서의 응답 형태를 그대로 구현 + 지연 300ms
└─ real.ts     # 실제 fetch
```
**mock에 실패 케이스를 반드시 넣습니다**: `401` · `403` · 명단 불일치(단일 문구) · 토큰/코드 만료 · `STORAGE_LIMIT` · 업로드 실패 · 빈 목록.
성공 경로만 만들면 통합 때 무너집니다.

### 12.2 401 처리 흐름
```
API 401 → POST /api/auth/refresh 1회 시도
  성공 → 원래 요청 재시도
  실패 → 로그인 화면으로 이동
```

### 12.3 401 vs 403 화면 분기
~~`PENDING_APPROVAL` → `/pending`~~ 은 v1.3에서 폐기됐습니다 (승인 절차 소멸).
대신 비공개 열람에서 **`401`은 로그인 유도 화면, `403`은 권한 없음 안내**로 나눠
처리합니다 (§10 주의 3). 같은 실패를 한 화면으로 뭉개면 회원이 "로그인해도 안 되는"
것과 "로그인 안 해서 안 되는" 것을 구별할 수 없습니다.

---

## 13. 출석부 (`/api/attendance`) — 신규 2026-08-28

> ### 상태: **FE·BE 구현 완료 (BE는 2026-09-03, PR #161)**
>
> `SPEC_FUNCTIONAL §9`에서 제외했던 기능을 **2026-08-28 결정으로 편입**했다
> (범위 결정은 `handoff/2026-08-28-auth-roster-model.md §7·§9-E` ·
> `DECISIONS.md` 2026-08-28). FE가 mock으로 화면을 먼저 완성하며 이 계약을
> 구체화했고, 착수 조건이었던 로그인·권한 재설계(v1.3)와 `member_roster`가
> 끝나면서 **BE가 2026-09-03에 구현했다** (PR #161 → `develop` #162).
>
> - BE: `backend/src/main/java/kr/light/attendance/` · 마이그레이션 `V6__attendance.sql`
> - FE: `frontend/src/app/admin/attendance/`
>
> ⚠️ **`member_roster` 테이블(재설계 §6.1)에 의존한다.** 출결 대상은
> 계정(member)이 아니라 **명단**이다 — 계정을 만들지 않은 교인도 체크한다.

권한은 **전부 `L`(임원) 이상**이다. 본인 출결 조회(`GET /attendance/me`)와
마을별 통계(`GET /attendance/stats`)는 **1차 범위에서 제외**했다 (§9-E 권장안).

### 13.0 공통 — 상태 값

`status`: `PRESENT`(출석) \| `LATE`(지각) \| `ABSENT`(결석) \| `EXCUSED`(공결)

- ⚠️ **`null`(기록 없음)은 `ABSENT`와 다르다.** 아무도 체크하지 않은 사람과
  결석으로 기록된 사람을 화면과 집계가 구별해야 한다
- ⚠️ 출석 기록은 "누가 교회에 안 나왔는지"의 기록이다 — **예산안과 같은 급의
  민감 정보**로 다룬다. 응답에 전화번호 등 불필요한 개인정보를 싣지 않는다

### 13.1 `GET /api/attendance/sessions?page=&size=`
권한 `L` · 날짜 내림차순
```json
{
  "data": {
    "items": [
      {
        "id": "as-2", "date": "2026-08-24", "type": "SUNDAY_SERVICE",
        "title": "주일예배",
        "checkedCount": 4, "presentCount": 3, "rosterCount": 15
      }
    ],
    "page": 0, "size": 20, "hasNext": false
  }
}
```
- `checkedCount`(상태가 기록된 인원, 값 무관) · `presentCount`(`PRESENT` 인원) ·
  `rosterCount`(active 명단 전체) — 목록 화면이 "체크 4/15" 진행 상태를
  회차마다 상세 조회 없이 보여주기 위한 집계다
- `type`: `SUNDAY_SERVICE` \| `ETC` (값 목록은 BE 합의 대상 — §7 예시에는
  `SUNDAY_SERVICE`만 있었다)

### 13.2 `POST /api/attendance/sessions`
권한 `L`
```json
// 요청
{ "date": "2026-08-30", "type": "SUNDAY_SERVICE", "title": "주일예배" }
```
```json
// 201
{ "data": { "id": "as-3" } }
```

| 실패 | code | 상황 |
|---|---|---|
| 날짜 형식 오류 (`YYYY-MM-DD` 아님) | `VALIDATION_ERROR` (`field: "date"`) | |
| 이름이 빈 값 | `VALIDATION_ERROR` (`field: "title"`) | |
| **같은 날짜 + 같은 종류가 이미 있음** | `DUPLICATE` (409) | 실수로 회차가 둘 생기면 출결이 갈라진다 |

### 13.3 `GET /api/attendance/sessions/{id}`
권한 `L` · 회차 + **명단 전원**의 출결
```json
{
  "data": {
    "id": "as-2", "date": "2026-08-24", "type": "SUNDAY_SERVICE", "title": "주일예배",
    "entries": [
      { "rosterId": "r01", "name": "강OO", "village": "1", "status": "PRESENT" },
      { "rosterId": "r05", "name": "정OO", "village": "2", "status": null }
    ]
  }
}
```
- `entries`는 **명단 전원**이다 (체크된 사람만이 아니라). 정렬은
  마을(숫자, `newcomer`는 뒤) → 이름 — 체크 화면이 마을 단위로 도는 것을 전제한다
- ⚠️ **`village`는 `null`일 수 있다.** 명단의 마을은 교회가 주는 CSV에서 오는데
  그 열이 비어 있을 수 있다 (`member_roster.village`는 nullable이고 CHECK도 없다).
  정렬에서는 `newcomer`보다도 **뒤**이고, 화면은 이들을 "마을 미배정"으로 묶는다.
  숫자가 아닌 값(예: `"청년1"`)이 오면 숫자 마을들 뒤 · `newcomer` 앞에 놓인다
- `active = false`인 사람(명단에서 빠진 사람)은 나오지 않는다
- 없는 id는 `NOT_FOUND`

### 13.4 `PUT /api/attendance/sessions/{id}/entries`
권한 `L` · `204`
```json
// 요청 — ⚠️ 배열이 곧 본문이다 (envelope 없음)
[
  { "rosterId": "r05", "status": "PRESENT" },
  { "rosterId": "r06", "status": "ABSENT" }
]
```

⚠️ **전체 교체가 아니라 upsert다.** 보낸 항목만 덮고 나머지는 그대로 둔다.
두 임원이 동시에 서로 다른 마을을 체크하는 것이 정상 흐름이라, 전체 교체로
구현하면 서로의 기록을 덮어쓴다. FE도 이 전제로 **변경분만** 보낸다.

| 실패 | code | 상황 |
|---|---|---|
| 명단에 없는 `rosterId` | `VALIDATION_ERROR` (`field: "rosterId"`) | |
| 없는 회차 | `NOT_FOUND` | |

### 13.5 `DELETE /api/attendance/sessions/{id}`
권한 `L` · `204` · 출결 기록까지 삭제

FE는 1차에서 삭제 버튼을 두지 않았다 (실수 삭제 비용 > 기능 가치 —
필요해지면 확인 절차와 함께 붙인다). API 계층(`real.ts`)에는 준비돼 있다.

---

## 14. 전도사·임원 알림 (`/api/admin/notifications`) — 신규 2026-09-09

> 🙏 **`[CONTRACT]` — PM·FE 합의가 필요합니다.** `§9.1`이 정한 "성공 시 담당자에게
> 알림 메일"을 **웹 알림으로 바꿉니다.** 요구가 사라진 것이 아니라 **전달 수단만**
> 바뀝니다("새가족이 오면 담당자가 안다"는 그대로입니다). FE에 새 화면이 필요하므로
> 합의 전에는 구현만 있고 화면은 없는 상태입니다.

### 14.0 왜 메일이 아닌가

메일은 **발신 도메인·SPF·수신자 명단**이 정해져야 보낼 수 있습니다. 그 결정이
나지 않아 `NewcomerNotifier` 구현체는 `id`만 로그로 남기는 상태로 몇 달이
지났습니다 — 즉 **실제로는 아무에게도 알려지지 않았습니다.**

웹 알림은 그 결정을 기다리지 않습니다. **이미 로그인해 있는 사람에게** 띄우는
것이라 도메인도 명단도 필요 없습니다.

**지금 알림을 만드는 것은 새가족 신청뿐입니다.** 사진 신고(`§6.10`)·용량
경고(`§8.5`)는 뒤에 붙일 수 있게 응답에 `type`을 두었지만, 값은 아직
`NEWCOMER` 하나입니다.

### 14.1 `GET /api/admin/notifications`
권한 `L`

```json
{
  "data": {
    "unreadCount": 3,
    "hasMore": false,
    "readMarker": "2026-09-09T04:12:33.481Z",
    "items": [
      {
        "type": "NEWCOMER",
        "refId": "14",
        "subject": "김OO",
        "createdAt": "2026-09-09T04:12:33.481Z"
      }
    ]
  }
}
```

| 필드 | 값 |
|---|---|
| `unreadCount` | 안 읽은 수. **`items` 길이가 아니라 이 값으로 배지를 만듭니다** |
| `items` | 최근이 위. **최대 20건**에서 잘립니다 |
| `hasMore` | 20건보다 많아 잘렸는가 |
| `readMarker` | `§14.2`에 그대로 되돌려줄 값. 안 읽은 것이 없으면 `null` |
| `items[].type` | 지금은 `NEWCOMER` 하나. **FE는 이 값으로 갈라 쓰세요** |
| `items[].refId` | `type=NEWCOMER`면 새가족 신청 `id` — `§8.6` 목록의 항목입니다 |
| `items[].subject` | 신청자 이름. **문구는 서버가 만들지 않습니다** (아래) |

⚠️ **완성된 문장을 내려주지 않습니다.** "새가족 신청이 들어왔습니다" 같은 말은
FE가 `type`을 보고 붙입니다 — 서버가 문장을 만들면 문구를 고칠 때마다 배포해야
합니다.

⚠️ **전화번호는 넣지 않았습니다.** 이름만으로 누가 왔는지 알 수 있고, 연락처는
`§8.6` 목록에 이미 있습니다. 알림은 화면 구석에 오래 떠 있는 편이라 개인정보를
여기까지 늘리지 않습니다.

⚠️ **밀어주지 않습니다(폴링).** FE가 주기적으로 부릅니다 — **30초~1분** 권장.
새가족 연락은 초 단위로 급한 일이 아니고, Web Push는 서비스 워커·구독 저장·VAPID
키가 필요해 이 기능 하나로 들이기에는 무겁습니다.

⚠️ **한 번도 읽지 않은 계정에는 남아 있는 신청이 전부 안 읽음으로 보입니다.**
새로 임원이 된 사람이 대표적입니다. `§8.6` 보유기간이 1년이라 그만큼으로
한정되고, **놓치는 쪽보다 많이 보이는 쪽이 안전**해서 이렇게 두었습니다.

### 14.2 `POST /api/admin/notifications/read`
권한 `L`

```json
// 요청 — 본문 전체를 생략할 수 있다
{ "until": "2026-09-09T04:12:33.481Z" }
```
```json
{ "data": { "readUntil": "2026-09-09T04:12:33.481Z", "unreadCount": 0 } }
```

★ **`§14.1`의 `readMarker`를 `until`에 그대로 넣으세요.** 그러면 **목록을 본 뒤
들어온 알림은 안 읽음으로 남습니다.**

`until`을 **생략하면 서버 시각까지 전부** 읽음입니다. 편하지만 목록과 이 요청
사이에 들어온 신청이 **조용히 사라질 수 있습니다** — 목록을 거치지 않는 「모두
읽음」 버튼을 위해 남겨둔 길입니다.

| 상황 | 동작 |
|---|---|
| `until` 생략 · 본문 없음 | 서버 시각까지 전부 읽음 |
| `until`이 미래 | 서버 시각으로 자름 (클라이언트 시계가 앞설 수 있음) |
| `until`이 이미 표시한 시각보다 과거 | **무시** — 읽은 알림이 되살아나지 않음 |
| 같은 요청 반복 | 안전 (멱등) |

`readUntil`은 **실제로 표시된 시각**이라 보낸 `until`과 다를 수 있습니다.
`unreadCount`를 함께 주는 이유는 배지를 갱신하려고 목록을 한 번 더 부르지 않게
하기 위해서입니다.

### 14.3 읽음은 사람별입니다

★ **임원 한 명이 눌러도 다른 사람의 배지는 그대로입니다.**

팀 공유로 두면 한 사람이 열어본 것만으로 모두의 알림이 사라집니다. 하지만
**열어본 것과 실제로 연락한 것은 다릅니다.** 새가족 연락은 늦어도 되지만
빠뜨리면 안 되는 종류라 각자에게 남게 했습니다 (2026-09-09 BE 결정).

### 14.4 알림을 저장하지 않습니다

안 읽은 새가족 신청은 `newcomer_requests`에 이미 전부 있습니다. 저장하는 것은
**사람마다 "어디까지 봤는지" 시각 하나**(`newcomer_notification_reads`)뿐이고,
알림 목록은 그 시각으로 매번 계산합니다.

그래서 **`§8.6` 보유기간 1년이 알림에도 그대로 적용됩니다** — 원본이 지워지면
알림도 사라지고, 따로 지울 것이 없습니다. 알림 내용을 복사해 두었다면 신청은
없는데 알림만 남는 상태가 생깁니다.

⚠️ 알림 종류가 늘어나면(`§6.10` 신고 · `§8.5` 용량) 이 방식으로는 부족합니다.
그때는 `type`을 가진 표가 필요하고, `type` 필드를 지금 둔 이유가 그때 **FE 화면을
다시 만들지 않게** 하려는 것입니다.

### 14.5 FE가 할 일

1. 헤더에 배지 — `unreadCount`를 30초~1분 주기로 갱신 (`L` 이상일 때만 호출)
2. 배지를 누르면 목록 — `type`으로 문구를 붙이고, `refId`로 `§8.6` 목록의 해당
   항목으로 이동
3. 「읽음」을 누를 때 **`readMarker`를 `until`로 되돌려주기**
4. `M` 계정에서는 호출하지 않기 — `403`입니다

---

관련 문서: 기능 요구는 [`SPEC_FUNCTIONAL.md`](SPEC_FUNCTIONAL.md) · 비기능 요구는 [`SPEC_NONFUNCTIONAL.md`](SPEC_NONFUNCTIONAL.md) · 협업 규칙은 [`INTEGRATION.md`](../ops/INTEGRATION.md)
