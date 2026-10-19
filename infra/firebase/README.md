# Firebase — 앱 푸시 알림(FCM)

> 2026-10-19 작성. 목적은 **앱 푸시 알림 하나**(공지를 올리면 알림).
> Firebase의 다른 기능(DB · 인증 · 애널리틱스 · 호스팅)은 쓰지 않는다.

| 항목 | 값 |
|---|---|
| 프로젝트 | 표시 이름 `LIGHT` · ID **`light-kr-app`** · 번호 `939456752834` |
| 요금제 | Spark(무료). FCM은 무료이며 유료 전환할 일 없음 |
| 소유자 | `gongtiger1011@gmail.com` (PM) — 인수인계 전에 공용 계정을 소유자로 추가할 것 |
| 콘솔 | https://console.firebase.google.com/project/light-kr-app/overview |
| Android 앱 | `kr.light.app` · 앱 ID `1:939456752834:android:c6e61b8f8de843656d5f5b` |
| iOS 앱 | 미등록 — iOS 보류 중 (`infra/mobile/README.md`). 할 때 APNs 인증 키(.p8, Apple 개발자 계정)가 필요 |
| 애널리틱스 | 사용 안 함 |

## 1. 파일 두 개 — 공개해도 되는 것과 절대 안 되는 것

| 파일 | 어디 | 공개 | 쓰는 곳 |
|---|---|---|---|
| `google-services.json` | `mobile/android/app/` (**저장소에 커밋**) | ✅ 괜찮다 | 앱이 어느 Firebase 프로젝트인지 안다 |
| 서비스 계정 키 | PM PC `C:\Users\SSAFY\light-signing\light-kr-app-firebase-adminsdk-fbsvc-6ac41fb2e3.json` (저장소 **밖**, 2026-10-19 발급 · 유일한 원본 — 백업 필요) | ❌ 절대 안 됨 | 백엔드가 알림을 **보낸다** (`firebase-adminsdk-fbsvc@light-kr-app.iam.gserviceaccount.com`) |

- `google-services.json`은 비밀이 아니다 — 앱 APK를 열면 누구나 볼 수 있는 값이다
  (Firebase 공식 안내). CI가 따로 주입할 필요 없게 커밋한다
- **서비스 계정 키는 우리 이름으로 아무에게나 푸시를 보낼 수 있는 키다.** 저장소 · 채팅 ·
  노션에 붙이지 않는다. `secret-scan.yml`이 `"private_key_id"`를 잡아 커밋을 막는다
- 키가 샜다면: 콘솔 → 프로젝트 설정 → 서비스 계정 → (Google Cloud 콘솔) 해당 키 **삭제** →
  새 키 발급 → Render 환경변수 교체

## 2. 백엔드(Render) 설정

백엔드가 FCM으로 보낼 때 서비스 계정 키를 **환경변수 하나**로 받는다 (제안 —
구현은 백엔드 담당, `docs/backend/BACKEND_HANDOFF.md` 2026-10-19).

| 이름 | 값 |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | 서비스 계정 키 JSON **파일 내용 전체** (한 줄로 붙여 넣어도 된다) |

Render 서비스 → Environment → Add Environment Variable. 값이 없으면 백엔드는
알림만 건너뛰고 나머지는 정상 동작해야 한다 (로컬 · 테스트 · CI에는 넣지 않는다).

## 3. 다시 만들 때 (기록)

```bash
npm install -g firebase-tools
firebase login                       # 비대화형 셸이면 URL → 코드 → firebase login <코드>
firebase projects:create light-kr-app --display-name "LIGHT"
firebase apps:create android "LIGHT Android" --package-name kr.light.app --project light-kr-app
firebase apps:sdkconfig ANDROID <앱 ID> --project light-kr-app --out mobile/android/app/google-services.json
```

함정 (2026-10-19 실측):
- **처음 Firebase를 쓰는 계정은 CLI의 `projects:create`가 403으로 실패한다** — 약관 동의가
  안 돼서다. Google Cloud 프로젝트만 만들어지고 Firebase는 안 붙는다. 콘솔에서
  `https://console.firebase.google.com/u/0/project/<ID>/overview`로 **직접** 들어가 약관에
  동의하면 붙는다 (콘솔 첫 화면의 "기존 프로젝트에 추가" 목록에는 안 보였다)
- Windows에서 `firebase` 명령 끝에 `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`가
  찍히지만 종료 시 메시지일 뿐 결과와 무관하다
- 서비스 계정 키는 CLI로 못 만든다 — 콘솔 → 프로젝트 설정 → 서비스 계정 → **새 비공개 키 생성**
