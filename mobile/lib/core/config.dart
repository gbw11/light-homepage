/// 백엔드 API 주소 (`/api`까지 포함).
///
/// 웹은 Next.js rewrites로 같은 출처에서 `/api`를 부르지만, 앱에는 프록시가 없어
/// 백엔드를 직접 부른다. 빌드·실행할 때 바꾼다:
///
///     flutter run --dart-define=API_BASE_URL=https://<백엔드 주소>/api
///
/// 기본값 `10.0.2.2`는 Android 에뮬레이터에서 본 **PC의 localhost**다.
const apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:8080/api',
);
