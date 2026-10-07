# 모바일 앱 (Android) — 서명 키 · 릴리스

> 2026-10-07 작성. Android 우선 — iOS는 Android 출시 후 다시 본다
> (`docs/records/DECISIONS.md` 2026-10-07).

| 항목 | 값 |
|---|---|
| 앱 ID | **`kr.light.app`** (Android `applicationId` · iOS 번들 ID 공통) |
| 앱 이름 | `LIGHT` |
| CI | `.github/workflows/mobile-ci.yml` · Jenkins `Mobile` 스테이지 (`docs/ops/CICD.md §3.8`) |
| 릴리스 | `.github/workflows/mobile-release.yml` — `mobile-v*` 태그 |
| API 주소 | `mobile/env/prod.json` → `https://light-homepage.onrender.com/api` |

> ⚠️ **앱 ID는 스토어에 한 번 올리면 바꿀 수 없습니다.** 바꾸면 다른 앱이 됩니다.

---

## 1. ⚠️ 서명 키 — 잃어버리면 업데이트가 끊긴다

Android는 **같은 키로 서명된 APK만 업데이트로 받아들입니다.** 키를 잃어버리면
이미 설치한 사람들은 앱을 지우고 새로 깔아야 합니다(로그인 상태도 사라짐).
키가 새면 남이 우리 앱인 척 서명한 APK를 업데이트로 밀어 넣을 수 있습니다.

| 무엇 | 어디 |
|---|---|
| 키스토어 원본 | PM PC `C:\Users\SSAFY\light-signing\upload-keystore.jks` (저장소 **밖**) |
| 비밀번호 | 같은 폴더 `key.properties` (store·key 비밀번호 동일 — PKCS12) |
| 별칭 | `upload` |
| CI용 사본 | GitHub Secrets `ANDROID_KEYSTORE_BASE64` · `ANDROID_KEYSTORE_PASSWORD` · `ANDROID_KEY_ALIAS` |
| 인증서 SHA-256 | `C8:4E:55:13:39:F6:0C:2D:92:A1:3C:46:8A:F8:20:92:D5:6A:48:23:B2:B0:F3:61:78:1C:42:5A:AA:57:1B:24` |
| 유효기간 | 10000일 (2026-10-07 생성) |

### ★ 백업 — 지금 PM PC 한 곳에만 있다

GitHub Secrets는 **다시 꺼내 볼 수 없습니다** (쓰기 전용). 그래서 PC 원본이
유일한 사본입니다. PC를 포맷하거나 교체하면 키가 사라집니다.

- [ ] `light-signing` 폴더를 **교회 계정 소유의 비공개 저장소**(예: 교회 Google 드라이브
      비공개 폴더, 비밀번호 관리자 첨부)에 백업한다 — 키 파일과 비밀번호를 **다른 곳**에 두면 더 좋다
- [ ] 백업 위치를 교회 계정 이관 문서에 적는다 (사람이 바뀌어도 찾을 수 있게)

> Play 스토어에 올리게 되면 **Play App Signing**을 켭니다. 그러면 이 키는 "업로드 키"가
> 되고 실제 배포 서명은 Google이 보관하는 키로 합니다 — 업로드 키를 잃어도 Play
> Console에서 재설정할 수 있게 됩니다. 직접 배포(APK)하는 동안은 이 보호가 없습니다.

## 2. 키를 새로 만들거나 CI에 다시 넣을 때

```bash
# 생성 (이미 있으면 덮어쓰지 말 것 — §1)
keytool -genkeypair -v -keystore upload-keystore.jks -storetype PKCS12 \
  -keyalg RSA -keysize 2048 -validity 10000 -alias upload \
  -dname "CN=LIGHT, O=LIGHT, C=KR"

# GitHub Secrets 등록 (값이 화면·히스토리에 남지 않게 파이프로)
base64 -w0 upload-keystore.jks | gh secret set ANDROID_KEYSTORE_BASE64
gh secret set ANDROID_KEYSTORE_PASSWORD     # 프롬프트에 붙여넣기
printf 'upload' | gh secret set ANDROID_KEY_ALIAS
```

로컬에서 release 서명으로 빌드하려면 `mobile/android/key.properties`를 만듭니다
(gitignore됨 · `secret-scan.yml`도 막음). 없으면 debug 키로 서명됩니다.

```properties
storeFile=C:/Users/SSAFY/light-signing/upload-keystore.jks
storePassword=...
keyAlias=upload
keyPassword=...
```

## 3. 릴리스 절차

1. `mobile_develop` → `develop` 머지까지 끝낸다 (CI ✅)
2. 태그를 단다 — **버전 이름만** 정하면 된다. versionCode는 워크플로 실행 번호로 자동 증가
   ```bash
   git tag mobile-v1.0.0 <develop의 커밋>
   git push origin mobile-v1.0.0
   ```
3. `Mobile Release` 워크플로가 서명된 APK·AAB를 만들어 **GitHub Release**(pre-release)에 붙인다.
   debug 키로 서명됐으면 워크플로가 실패한다(서명 확인 단계)
4. 배포 — §4

태그 없이 시험 빌드만 하려면 Actions → Mobile Release → **Run workflow** (산출물 14일 보관).

## 4. 배포 채널 (현재: APK 직접 배포)

Play 등록 전까지는 GitHub Release의 APK를 교회 내부에 직접 나눕니다.

- 받는 사람: 폰에서 APK 열기 → "출처를 알 수 없는 앱 설치 허용" → 설치
- ⚠️ 저장소가 private이라 Release 링크는 협업자만 열립니다. 교인에게는 APK 파일을
  따로 전달해야 합니다 (단톡방 등)
- 업데이트: 새 APK를 같은 방식으로 설치하면 덮어써진다 (같은 키라서 — §1)

### 다음 단계 (결정 대기)

| 결정 | 영향 |
|---|---|
| Play 개발자 계정 ($25 일회) · 명의(교회 조직/개인) | 개인 계정은 프로덕션 전 테스터 12명 × 14일 비공개 테스트 조건이 있다(정책 재확인 필요) |
| Play 업로드 자동화 | 서비스계정 JSON → `PLAY_SERVICE_ACCOUNT_JSON` 시크릿, `mobile-release.yml`에 internal 트랙 업로드 단계 추가 |
| iOS | Apple 개발자 등록($99/년) + macOS 빌드(Codemagic 무료 티어 권장 — Windows PC만 있음) |

비용 항목은 `docs/ops/COST_GUARDRAILS.md §2`.
