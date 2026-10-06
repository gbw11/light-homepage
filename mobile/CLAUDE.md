# 모바일 앱 작업 가이드 — 여기서 시작

`mobile/`은 웹(`../frontend`)과 **같은 백엔드**(`../backend`)를 쓰는 Flutter 앱이다.
이 파일은 안내판이다 — 계약·기능·화면의 기준은 루트 `docs/`에 있고, 여기서는
언제 무엇을 읽는지와 앱에만 해당하는 규칙만 적는다.

## 범위 (2026-10-06 시작 시점)

- **Android 먼저.** 개발 PC가 Windows라 iOS는 빌드할 수 없다 (Mac 필요)
- **1차는 열람 위주** — 공개 콘텐츠(주보·설교·공지)와 로그인 후 회원 콘텐츠
  (내부공지·사진첩·월례회) 보기. 업로드·관리 화면은 웹에 남긴다
- **카카오 로그인 보류** — 백엔드 콜백이 웹 경로(`/my`)로 리다이렉트한다.
  앱으로 돌아오는 분기가 백엔드에 먼저 필요하다 (`[CONTRACT]` 변경)
- `../frontend/`·`../backend/`는 다른 사람 영역이다. 고쳐야 하면 먼저 묻는다

## 언제 무엇을 읽는가

| 언제 | 문서 |
|---|---|
| API를 붙일 때 | [`../docs/spec/SPEC_API.md`](../docs/spec/SPEC_API.md) — 백엔드 계약. 앱도 웹과 같은 계약을 쓴다 |
| 기능을 만들 때 | [`../docs/spec/SPEC_FUNCTIONAL.md`](../docs/spec/SPEC_FUNCTIONAL.md) |
| 화면을 만들 때 | [`../docs/spec/WIREFRAME.md`](../docs/spec/WIREFRAME.md) — 웹 기준이라 모바일 화면에 맞게 옮긴다 |
| 웹은 이걸 어떻게 했나 궁금할 때 | `../frontend/src/lib/api/` (호출 규칙) · `../frontend/src/types/api.ts` (응답 타입) |
| 브랜치·PR | [`../docs/ops/INTEGRATION.md`](../docs/ops/INTEGRATION.md) §6 |

## 코드 규칙

- 백엔드 호출은 **`lib/core/api/api_client.dart`의 `ApiClient`만** 거친다.
  401 → 리프레시 1회 → 재시도, 세션 만료 알림이 여기 모여 있다 (웹 `real.ts`와 같은 규칙)
- 토큰을 직접 다루지 않는다 — JWT는 httpOnly 쿠키이고 `CookieJar`가 보관한다
- ID는 **문자열**, 날짜는 `YYYY-MM-DD`, 시각은 UTC ISO-8601 (`SPEC_API §1.3`)
- 화면 분기는 `ErrorCode`로 한다. 분기하는 값은 6개뿐이다 (`SPEC_API §1.2`)
- 목록 응답은 `PageResult` (`lib/core/api/page.dart`). 사진만 커서 방식이다

## "됐다"의 기준

아래 두 개가 모두 통과해야 완료다. **CI는 아직 `mobile/`을 검사하지 않으므로**
로컬에서 직접 돌린다.

```sh
flutter analyze
flutter test
```

화면이 의도에 맞는지는 사람이 에뮬레이터로 보고 판단한다 — 테스트 통과와 별개다.

## 실행

```sh
flutter run                                         # 에뮬레이터 → PC의 로컬 백엔드(10.0.2.2:8080)
flutter run --dart-define=API_BASE_URL=https://<백엔드 주소>/api
```

로컬 백엔드는 http라서 debug 빌드에서만 평문 통신을 연다
(`android/app/src/debug/AndroidManifest.xml`).

## 기록과 미정 사항

- **백엔드에 요청할 것이 생기면** (예: 카카오 딥링크, 앱 전용 응답)
  [`../docs/backend/BACKEND_HANDOFF.md`](../docs/backend/BACKEND_HANDOFF.md)에 적는다.
  전달은 PM이 판단한다
- [`../docs/records/DECISIONS.md`](../docs/records/DECISIONS.md)는 **PM 결정 기록**이다.
  앱 범위가 PM에게 확정되면 그때 적는다

## 브랜치 (`INTEGRATION.md §6` — fe·be와 같은 구조)

```
develop
└─ mobile_develop        통합 브랜치 (영구 — 지우지 않는다, 직접 커밋하지 않는다)
   └─ feat/mobile-*      실제 작업 · 버그는 fix/mobile-*
```

- `feat/mobile-*` → `mobile_develop`: **Squash merge**, 셀프 머지 허용
- `mobile_develop` → `develop`: **Merge commit**, 통합 체크포인트(§7)에 맞춰
- 커밋 scope는 `mobile` — `feat(mobile): 주보 목록 화면`
- ⚠️ PR을 만들면 GitHub 기본 대상이 `develop`이다. **`mobile_develop`으로 바꾼다.**
  `branch-policy.yml`이 아직 `feat/mobile-*`을 검사하지 않아 잘못 올려도 경고가 안 뜬다
