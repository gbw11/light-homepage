# 백엔드 전달 — 사진 대량 업로드 (2026-08-24)

**보내는 쪽**: 프론트엔드 · **받는 쪽**: 백엔드
**대상 기능**: `FR-PHO-08` 사진 대량 업로드 (`SPEC_API §6.5` · `§6.6`)
**관련 브랜치**: `feat/fe-photo-upload` → `frontend_develop` 머지 완료

> 이 문서는 **BE가 바로 착수할 수 있게 정리한 실행용 브리핑**이다.
> 프론트 전체 인계 로그는 `docs/BACKEND_HANDOFF.md`에 시간순으로 쌓여 있고,
> 이 파일은 그중 오늘 자 사진 업로드 항목만 떼어 온 것이다.

---

## 0. 한 줄 요약

FE는 업로더를 **다 만들었고 mock으로 검증까지 끝냈다.** 남은 것은 전부 BE 쪽이다.
그리고 **착수 전에 결정해야 할 계약 구멍이 1건 있다** (§1). 이걸 정하지 않고
구현하면 R2에 주인 없는 객체가 쌓인다.

`WORKPLAN §8.2`가 "최대 위험"으로 지목한 접점이 정확히 이 기능이다. 파일이
Spring을 통과하지 않고 **브라우저 → R2로 직접** 가기 때문에, 서명·CORS가 한 칸만
틀려도 화면에는 "전송 실패"로만 보인다.

---

## 1. ⚠️ 먼저 정해야 하는 것 — `§6.5` 재시도 규칙에 요청 필드가 없다

`SPEC_API §6.5` 설명에는 이렇게 적혀 있다.

> 재시도는 **같은 `photoId`로 재발급**합니다 (고아 방지)

그런데 **요청 스키마에 `photoId`를 보낼 자리가 없다.** `files[]`에는 `clientId`뿐이다.

```json
// §6.5 현재 요청 스키마
{ "albumId": "5",
  "files": [ { "clientId": "f1", "sizeBytes": 1250000, "thumbSizeBytes": 82000,
               "width": 2560, "height": 1707, "takenAt": "..." } ] }
```

그래서 지금 상태로 구현하면, 재시도할 때 서버가 **새 `photoId` + 새 `PENDING` 행**을
만든다. 앞선 시도에서 view는 올라갔고 thumb만 실패했다면, 그 view 객체는 주인이
없어진다 — §6.5가 막으려던 바로 그 상황이다.

### 결정해 주세요 (택 1)

| 안 | 계약 변경 | BE 작업 | FE 작업 |
|---|---|---|---|
| **A (FE 권장)** | `§6.5` `files[]`에 **`photoId?` (optional)** 추가 | 값이 있으면 그 `PENDING` 행을 재사용하고 URL만 다시 서명 | **FE는 이미 `photoId`를 상태에 들고 있다.** 요청에 실어 보내기만 하면 된다 (10줄) |
| B | 없음 (설명 문구만 삭제) | 재시도도 새 행. 고아는 24시간 정리 배치에 맡긴다 | 없음 |

**A를 권한다.** B는 "실패 → 재시도" 한 번에 R2 객체가 최대 2개씩 버려지고, 정리
배치가 도는 24시간 동안 용량 집계(§6.5의 95% 차단)를 부풀린다. 200장 업로드에서
20장이 재시도되면 무시할 수 없는 양이다.

FE는 지금 **A를 전제로** `photoId`를 보관 중이다. B로 정하면 그 주석을 고친다.

---

## 2. R2 버킷 설정 — 이게 없으면 전송이 전부 실패한다

| # | 필요한 것 | 없으면 생기는 증상 |
|---|---|---|
| a | **버킷 CORS**: `PUT` 허용 · `AllowedOrigins`에 프론트 출처 · `AllowedHeaders`에 `Content-Type` | 브라우저가 preflight에서 막는다. 서버 로그에는 아무것도 안 남고 **화면에만 "전송 실패"** 가 뜬다 |
| b | presigned 서명에 **`Content-Type: image/webp` 포함** (또는 서명 대상에서 제외) | FE는 `Content-Type`을 **반드시** 붙인다(안 붙이면 R2가 기본값을 넣어 다운로드 시 문제가 된다). 서명과 다르면 **403** |
| c | 응답에 특별한 헤더 요구가 없는지 확인 | FE는 `2xx`만 성공으로 본다 |

**FE 전송 방식** (참고):
- `XMLHttpRequest`로 PUT한다 — 진행률이 필요해서 `fetch`를 쓸 수 없다
  (`fetch`는 업로드 진행률 이벤트가 없다)
- **쿠키를 보내지 않는다** (`withCredentials` false). 인증은 URL 서명에 있다는 전제다.
  서명 URL이 쿠키를 요구하는 구성이면 알려줄 것
- 파일 하나당 **PUT 2번** (view 2560px, thumb 640px)

---

## 3. FE가 보내는 값 — 그대로 저장하면 된다

`§6.5` `files[]`의 값은 전부 **리사이즈 후** 값이다. 촬영 원본 크기가 아니다.

| 필드 | 값 |
|---|---|
| `sizeBytes` | **2560px WebP**의 바이트 수 |
| `thumbSizeBytes` | **640px WebP**의 바이트 수 |
| `width` / `height` | 2560px 기준 리사이즈 결과 (장변 2560 · **확대는 하지 않는다** — 작은 사진은 원래 크기) |
| `takenAt` | EXIF `DateTimeOriginal` → ISO-8601. `OffsetTimeOriginal`이 없으면 **브라우저 로컬 타임존으로 해석**해서 UTC로 변환. EXIF가 없으면 `null` |

- 용량 한도 검사는 **`sizeBytes + thumbSizeBytes` 합**으로 하면 된다
- ⚠️ **회전은 FE가 이미 적용해서 보낸다.** 서버가 EXIF Orientation을 다시 적용하면
  사진이 두 번 돌아간다. FE는 `createImageBitmap(imageOrientation: "from-image")`로
  회전을 반영한 뒤 canvas에 그리므로, 업로드되는 WebP에는 EXIF 회전 정보가 없다
- 저장 포맷은 **WebP 고정**이다 (`ARCHITECTURE §4.2`)

---

## 4. 확인 요청 3건

| # | 질문 | 지금 FE 동작 |
|---|---|---|
| a | `expiresIn` 900(15분) 유지? | **20장씩 배치로 발급**하고, 배치가 끝나면 다음 배치를 발급한다. 200장이 15분을 넘겨도 만료된 URL을 쓰지 않는다 |
| b | `§6.6` `failed[].reason` 값 목록 | 문서에는 `OBJECT_NOT_FOUND`만 있다. FE는 **받은 문자열을 그대로 괄호에 넣어 보여준다**. 한국어 문구로 매핑하려면 값 목록이 필요하다 |
| c | commit 직후 앨범 `photoCount`·`coverThumbUrl`이 갱신되는가 | FE는 commit 성공 후 `albums` 쿼리를 무효화해 다시 읽는다. 서버가 커버를 늦게 계산하면 **방금 올린 사진이 커버로 안 잡힌다** |

---

## 5. 인가 매트릭스

`POST /uploads:issue` · `POST /uploads:commit` **둘 다 `L`(임원)**.

- `ARCHITECTURE §5.3`에는 두 줄 다 있다 (426~427행) — 새로 추가할 행은 없다
- ⚠️ **`SPEC_API §10` 표에는 `uploads:commit` 행이 빠져 있다** (`issue`만 있다).
  추가해 두면 인가 테스트 매트릭스(M4 최우선 항목)에서 누락되지 않는다

FE는 임원 미만에게 업로드 진입점을 감추지만, **그건 UI 편의일 뿐이다**
(`WORKPLAN §5.1`). 회원이 URL을 직접 쳐서 들어와도 `issue`가 서버에서 막아야 한다.

---

## 6. BE 작업 체크리스트

착수 순서대로.

- [ ] **§1 결정** — `files[]`에 `photoId?`를 추가할지 (A/B)
- [ ] R2 버킷 CORS 설정 (§2a) — 이것부터. 없으면 나머지를 검증할 수 없다
- [ ] presigned PUT URL 발급 (`Content-Type` 서명 정책 확정, §2b)
- [ ] `POST /api/uploads:issue` — `PENDING` 행 생성 + 용량 95% 검사 → `STORAGE_LIMIT`
- [ ] `POST /api/uploads:commit` — `COMMITTED` 전환 + `size_bytes` 기록 + 앨범 집계
- [ ] 미커밋 `PENDING` 24시간 정리 배치
- [ ] `§10` 인가 표에 `uploads:commit` 행 추가 (§5)

**통합 검증 (FE와 함께)**: 실사진 30장을 브라우저에서 올려서
① 앨범 그리드에 뜨는지 ② `photoCount`가 맞는지 ③ 중간에 한 장을 강제로 실패시켜
[재시도]가 **같은 photoId로** 복구되는지 (§1 A안을 택한 경우).

---

## 7. FE 쪽 현재 상태

| 항목 | 상태 |
|---|---|
| 화면 (`/admin/albums/[id]/upload`) | ✅ 완료 |
| 브라우저 리사이즈 (2560/640 WebP · EXIF 회전·촬영시각) | ✅ 완료 |
| 큐 (동시 4개 · 20장 배치 · 진행률) | ✅ 완료 |
| 실패 항목만 재시도 · 이탈 경고 · `STORAGE_LIMIT` 안내 | ✅ 완료 |
| mock 검증 (`?mock=upload-fail`, `?mock=storage`) | ✅ 완료 |
| **실제 R2 왕복** | ⬜ **BE 대기** — 여기가 `§8.2` 최대 위험 |

FE가 mock에서 무엇을 흉내내는지는 `frontend/README.md`의 `?mock=` 표에 있다.
