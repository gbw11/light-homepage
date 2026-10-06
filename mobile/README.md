# LIGHT 모바일 앱 (Flutter)

웹(`../frontend`)과 **같은 백엔드**(`../backend`)를 쓰는 Android·iOS 앱이다.
API 계약은 웹과 동일하게 [`../docs/spec/SPEC_API.md`](../docs/spec/SPEC_API.md)를 따른다.

## 실행

```sh
flutter pub get
flutter run                 # 기본: 에뮬레이터에서 PC의 로컬 백엔드(http://10.0.2.2:8080/api)
flutter run --dart-define=API_BASE_URL=https://<백엔드 주소>/api
```

## 검증

```sh
flutter analyze
flutter test
```

## 웹과 다른 점

| | 웹 | 앱 |
|---|---|---|
| 백엔드 주소 | Next.js rewrites로 같은 출처 `/api` | `API_BASE_URL`로 직접 호출 (`lib/core/config.dart`) |
| JWT 쿠키 | 브라우저가 보관 | `PersistCookieJar`가 앱 저장소에 보관 |
| 401 → 리프레시 1회 | `lib/api/real.ts` | `lib/core/api/api_client.dart` (같은 규칙) |

- 로컬 백엔드는 http라서 **debug 빌드에서만** 평문 통신을 허용한다
  (`android/app/src/debug/AndroidManifest.xml`).
- 카카오 로그인은 아직 없다. 백엔드 콜백이 웹 경로(`/my`)로 리다이렉트하므로
  앱으로 돌아오는 분기가 백엔드에 먼저 필요하다.
