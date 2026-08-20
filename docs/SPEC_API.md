# API 명세서 — LIGHT

- 문서 버전: v1.0
- Base URL: `/api` (Next.js `rewrites`로 Spring에 프록시 → **동일 출처**)
- 이 문서의 역할: **FE와 BE의 유일한 접점.** W0에서 이 문서를 합의한 뒤 각자 작업한다
- 구현되면 **Swagger UI**(`/swagger-ui.html`)가 살아있는 계약서가 되고, 이 문서는 합의 기준으로 남는다

> ⚠️ **비호환 변경은 조용히 하지 않습니다.** PR 제목에 `[CONTRACT]`를 붙이고 상대 승인을 받습니다 ([`INTEGRATION.md §5`](INTEGRATION.md))

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

### 1.2 에러 코드 — 이 7개만 사용
FE가 분기에 쓰는 값이므로 집합을 벗어나지 않습니다.

| code | HTTP | 의미 | FE 처리 |
|---|---|---|---|
| `UNAUTHORIZED` | 401 | 로그인 필요 | 로그인 화면으로 |
| `FORBIDDEN` | 403 | 권한 부족 | 접근 불가 안내 |
| `PENDING_APPROVAL` | 403 | 승인 대기 상태 | `/pending` 화면으로 |
| `NOT_FOUND` | 404 | 없음 또는 **권한이 없어 숨김** | 404 화면 |
| `VALIDATION_ERROR` | 400 | 입력값 오류 (`field`에 필드명) | 해당 입력란에 표시 |
| `STORAGE_LIMIT` | 409 | 저장 용량 초과 | 업로드 차단 + 안내 |
| `DUPLICATE` | 409 | 중복 (이메일·주보 날짜 등) | 해당 입력란에 표시 |

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
`G` GUEST · `P` PENDING · `M` MEMBER · `L` LEADER · `T` PASTOR (계단식 상위 포함)

### 1.6 페이징 기본값
`page=0`, `size=20` (최대 100). 사진 목록만 커서 방식입니다.

---

## 2. 인증 (`/api/auth`)

### 2.1 `POST /api/auth/signup` — 이메일 회원가입
권한 `G`

```json
// 요청
{
  "name": "김OO",
  "email": "user@example.com",
  "password": "비밀번호12!",
  "phone": "010-1234-5678",
  "village": "3",
  "agreed": true
}
```
| 필드 | 타입 | 필수 | 제약 |
|---|---|---|---|
| `name` | string | ✅ | 2~50자, 실명 |
| `email` | string | ✅ | 이메일 형식, 중복 불가 |
| `password` | string | ✅ | 8자 이상 |
| `phone` | string | ✅ | `010-0000-0000` |
| `village` | string | ✅ | `"1"`~`"9"` \| `"newcomer"` |
| `agreed` | boolean | ✅ | **`true`가 아니면 거부** |

```json
// 201
{ "data": { "id": "42", "role": "PENDING" } }
```
| 실패 | code |
|---|---|
| 이메일 중복 | `DUPLICATE` (field: `email`) |
| 동의 누락 | `VALIDATION_ERROR` (field: `agreed`) |

---

### 2.2 `POST /api/auth/login`
권한 `G`

```json
// 요청
{ "email": "user@example.com", "password": "비밀번호12!" }
```
```json
// 200 — 쿠키에 access/refresh 토큰이 설정된다
{
  "data": {
    "id": "42", "name": "김OO", "village": "3",
    "role": "MEMBER", "profileComplete": true
  }
}
```
| 실패 | code |
|---|---|
| 자격 불일치 | `UNAUTHORIZED` |
| 승인 대기 | `PENDING_APPROVAL` (로그인은 성공, 회원 API는 차단) |

---

### 2.3 `POST /api/auth/refresh`
권한 — (리프레시 쿠키 필요) · 응답 `200 { "data": { "refreshed": true } }`
리프레시 토큰은 **회전**합니다(사용 시 새로 발급). 실패는 `UNAUTHORIZED`.

### 2.4 `POST /api/auth/logout`
권한 로그인 · 쿠키 삭제 + 리프레시 토큰 DB 폐기 · `204`

### 2.5 `GET /api/auth/me`
권한 로그인
```json
{
  "data": {
    "id": "42", "name": "김OO", "email": "user@example.com",
    "phone": "010-1234-5678", "village": "3",
    "role": "MEMBER", "profileComplete": true,
    "approvedAt": "2026-08-20T02:11:00Z"
  }
}
```

### 2.6 `GET /api/auth/kakao/authorize`
권한 `G` · **302** → 카카오 인가 URL

### 2.7 `GET /api/auth/kakao/callback?code=...`
권한 `G` · **302** → FE로 리다이렉트 (쿠키 설정 후)

| 상황 | 리다이렉트 |
|---|---|
| 기존 계정 · 프로필 완료 | `/my` |
| 신규 계정 또는 프로필 미완 | `/signup/complete` |
| 승인 대기 | `/pending` |

⚠️ 카카오 이메일 수집은 비즈 앱 전환이 필요합니다. **이메일 없이도 계정이 생성되어야 합니다**(`kakao_id`로 식별).

### 2.8 `POST /api/auth/complete-profile`
권한 로그인 (카카오 가입자)
```json
// 요청
{ "name": "김OO", "phone": "010-1234-5678", "village": "3", "agreed": true }
```
```json
// 200
{ "data": { "profileComplete": true, "role": "PENDING" } }
```
카카오 닉네임은 실명이 아닌 경우가 많아 **실명을 별도로 받습니다**(승인 대조용).

### 2.9 `POST /api/auth/password/reset-request`
권한 `G` · 요청 `{ "email": "..." }` · **204** (계정 존재 여부를 노출하지 않기 위해 항상 204)

### 2.10 `POST /api/auth/password/reset`
권한 `G` · 요청 `{ "token": "...", "password": "새비밀번호12!" }` · `204`
토큰은 1회용이며 만료됩니다.

### 2.11 `PATCH /api/auth/me`
권한 `M` · 요청 `{ "phone": "010-9999-8888" }` · 응답 갱신된 프로필

### 2.12 `POST /api/auth/password/change`
권한 `M` · 요청 `{ "currentPassword": "...", "newPassword": "..." }` · `204`

### 2.13 `DELETE /api/auth/me` — 회원 탈퇴
권한 `M` · 요청 `{ "password": "..." }` · `204` · 개인정보 즉시 파기

---

## 3. 게시물 (`/api/posts`)

공지·회의록·예산안을 하나의 리소스로 다룹니다.

### 3.1 분류와 권한
| category | 의미 | 열람 | 작성 |
|---|---|---|---|
| `NOTICE_PUBLIC` | 공개 공지 | 누구나 | `L` |
| `NOTICE_MEMBER` | 내부 공지 | `M` | `L` |
| `MINUTES` | 회의록 | `L` | `L` |
| `BUDGET` | 예산안 | `L` | `L` |

⚠️ **분류별 열람 권한 검사는 서비스 계층의 단일 관문을 통과해야 합니다.** Controller가 받은 category를 그대로 신뢰하지 않습니다.

### 3.2 `GET /api/posts`
권한 분류별

| 쿼리 | 필수 | 설명 |
|---|---|---|
| `category` | ✅ | 위 4개 중 하나 |
| `page` `size` | — | 기본 0 / 20 |

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
권한 분류별

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
권한 **게시물 권한 상속** · **302** → presigned URL (10분)
파일 주소를 아는 것만으로 열려서는 안 됩니다. 로그아웃 상태 접근은 `UNAUTHORIZED`.

---

## 5. 주보 (`/api/bulletins`)

### 5.1 `GET /api/bulletins/latest`
권한 `M`
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

### 5.3 `GET /api/bulletins/{id}` — 5.1과 동일 형태

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

---

## 6. 사진첩 (`/api/albums`, `/api/photos`, `/api/uploads`)

### 6.1 `GET /api/albums?page=&size=`
권한 `M`
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
권한 `M` · **302** → presigned URL (`Content-Disposition: attachment`)

### 6.8 `GET /api/albums/{id}/download?ids=901,902,903`
권한 `M` · **최대 30장** · `application/zip` 스트리밍
| 실패 | code |
|---|---|
| 30장 초과 | `VALIDATION_ERROR` (field: `ids`) |

### 6.9 `DELETE /api/photos/{id}`
권한 `L` · `204` · R2 객체까지 삭제

### 6.10 `POST /api/photos/{id}/report` — 신고·삭제 요청
권한 `M` · 요청 `{ "reason": "본인 사진 삭제 요청합니다" }` · `204` · 임원에게 전달 (초상권 대응)

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
- `L` 이상은 `status`와 무관하게 열람 가능합니다

### 7.2 `GET /api/meetings/{id}`
권한 `M`
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

**응답: 이미지 바이너리** (`image/webp`)

| 헤더 | 값 |
|---|---|
| `Cache-Control` | `no-store, no-cache, must-revalidate` |
| `Content-Disposition` | `inline` |

처리 순서:
1. 인증·역할 확인
2. `L` 미만이면 열람 기간 검사 → 기간 외 **403**
3. R2에서 원본 페이지 읽기
4. **워터마크 합성** — 열람자 이름 · 연락처 뒷4자리 · 열람시각 · 문서ID
5. 스트리밍 응답
6. `meeting_doc_views` 기록

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
- **10페이지 내외 기준 15~30초** 소요 (동기 처리). FE는 진행 상태를 표시합니다
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

### 8.1 `GET /api/admin/members?status=PENDING&q=&page=&size=`
권한 **`T`**
```json
{
  "data": {
    "items": [
      {
        "id": "51", "name": "이OO", "email": "lee@example.com",
        "phone": "010-1234-5678", "village": "5",
        "role": "PENDING", "profileComplete": true,
        "createdAt": "2026-08-19T09:00:00Z", "approvedAt": null
      }
    ],
    "page": 0, "size": 20, "hasNext": false
  }
}
```
`status`: `PENDING` \| `ALL` · `q`: 이름 검색

### 8.2 `POST /api/admin/members/{id}/approve`
권한 **`T`** · `204` · `role=MEMBER`, `approved_at/by` 기록, 감사로그, 안내 메일 발송

### 8.3 `POST /api/admin/members/{id}/reject`
권한 **`T`** · 요청 `{ "reason": "청년교회 소속 확인 불가" }` · `204`

### 8.4 `PATCH /api/admin/members/{id}/role`
권한 **`T`** · 요청 `{ "role": "LEADER" }` · `204`

| 실패 | code | 상황 |
|---|---|---|
| 마지막 `PASTOR` 강등 | `VALIDATION_ERROR` | 아무도 회원을 승인할 수 없게 되는 것을 방지 |

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

---

## 9. 공개 (`/api/newcomers`)

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
- 성공 시 담당자에게 알림 메일

---

## 10. 인가 매트릭스 (테스트 기준)

⚠️ **RLS가 없으므로 이 표가 마지막 방어선입니다.** 자동 테스트로 검증하고 CI에서 실행합니다.

| 엔드포인트 | G | P | M | L | T |
|---|---|---|---|---|---|
| `GET /posts?category=NOTICE_PUBLIC` | 200 | 200 | 200 | 200 | 200 |
| `GET /posts?category=NOTICE_MEMBER` | 401 | 403 | 200 | 200 | 200 |
| `GET /posts?category=MINUTES` | 401 | 403 | **403** | 200 | 200 |
| `GET /posts?category=BUDGET` | 401 | 403 | **403** | 200 | 200 |
| `GET /posts/{예산안id}` | 401 | 403 | **404** | 200 | 200 |
| `POST /posts` | 401 | 403 | **403** | 200 | 200 |
| `GET /files/{예산안첨부id}` | 401 | 403 | **404** | 200 | 200 |
| `GET /bulletins/latest` | 401 | 403 | 200 | 200 | 200 |
| `POST /bulletins` | 401 | 403 | **403** | 200 | 200 |
| `GET /albums` | 401 | 403 | 200 | 200 | 200 |
| `POST /uploads:issue` | 401 | 403 | **403** | 200 | 200 |
| `GET /photos/{id}/download` | 401 | 403 | 200 | 200 | 200 |
| `DELETE /photos/{id}` | 401 | 403 | **403** | 200 | 200 |
| `GET /meetings` | 401 | 403 | 200 | 200 | 200 |
| `GET /meetings/{id}/pages/{n}` (기간 내) | 401 | 403 | 200 | 200 | 200 |
| `GET /meetings/{id}/pages/{n}` (**기간 외**) | 401 | 403 | **403** | 200 | 200 |
| `POST /meetings` | 401 | 403 | **403** | 200 | 200 |
| `GET /meetings/{id}/views` | 401 | 403 | **403** | 200 | 200 |
| `GET /admin/storage` | 401 | 403 | **403** | 200 | 200 |
| `GET /admin/newcomers` | 401 | 403 | **403** | 200 | 200 |
| `GET /admin/members` | 401 | 403 | 403 | **403** | 200 |
| `POST /admin/members/{id}/approve` | 401 | 403 | 403 | **403** | 200 |
| `PATCH /admin/members/{id}/role` | 401 | 403 | 403 | **403** | 200 |
| `POST /newcomers` | 200 | 200 | 200 | 200 | 200 |

**굵게 표시된 칸이 실제 사고가 나는 지점입니다.**
엔드포인트를 추가하면 이 표에 행을 추가합니다. **표에 없는 보호 엔드포인트는 미완성으로 봅니다.**

---

## 11. 마일스톤별 구현 순서

| M | 엔드포인트 |
|---|---|
| **M1** | `GET /posts`(공개만) · `GET /posts/{slug}` · `POST /newcomers` |
| **M2** | `/auth/*` 전체 · `POST/PUT/DELETE /posts` · `/admin/members/*` |
| **M3** | `/bulletins/*` · `/albums/*` · `/photos/*` · `/uploads:*` · `/admin/storage` |
| **M4** | `/meetings/*` · `/attachments` · `/files/{id}` · `/admin/newcomers` · `/photos/{id}/report` |

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
**mock에 실패 케이스를 반드시 넣습니다**: `401` · `403` · `PENDING_APPROVAL` · `STORAGE_LIMIT` · 업로드 실패 · 빈 목록.
성공 경로만 만들면 통합 때 무너집니다.

### 12.2 401 처리 흐름
```
API 401 → POST /api/auth/refresh 1회 시도
  성공 → 원래 요청 재시도
  실패 → 로그인 화면으로 이동
```

### 12.3 `PENDING_APPROVAL` 처리
회원 API가 이 코드를 반환하면 **어느 화면에 있든 `/pending`으로** 보냅니다.

---

관련 문서: 기능 요구는 [`SPEC_FUNCTIONAL.md`](SPEC_FUNCTIONAL.md) · 비기능 요구는 [`SPEC_NONFUNCTIONAL.md`](SPEC_NONFUNCTIONAL.md) · 협업 규칙은 [`INTEGRATION.md`](INTEGRATION.md)
