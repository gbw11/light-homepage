import 'package:flutter/foundation.dart';

/// 백엔드 API 주소 (`/api`까지 포함).
///
/// 웹은 Next.js rewrites로 같은 출처에서 `/api`를 부르지만, 앱에는 프록시가 없어
/// 백엔드를 직접 부른다. 빌드·실행할 때 환경 파일로 넘긴다:
///
///     flutter run --dart-define-from-file=env/dev.json     # 에뮬레이터 → PC 로컬 백엔드
///     flutter build apk --release --dart-define-from-file=env/prod.json
///
/// 기본값 `10.0.2.2`는 Android 에뮬레이터에서 본 **PC의 localhost**다.
const apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:8080/api',
);

/// release 빌드가 엉뚱한 주소로 나가는 것을 막는다.
///
/// `--dart-define-from-file=env/prod.json`을 빠뜨리고 release로 빌드하면
/// 기본값(에뮬레이터 주소)이 그대로 들어간 앱이 배포된다. 사용자 폰에서는 아무
/// 요청도 성공하지 않는데 빌드는 통과한다 — 그래서 **켜자마자** 실패시킨다.
/// release에서는 평문 http도 막혀 있다 (debug 매니페스트에만 cleartext 허용).
void checkApiBaseUrl(String url, {required bool release}) {
  if (!release) return;
  if (!url.startsWith('https://')) {
    throw StateError(
      'release 빌드의 API_BASE_URL이 https가 아닙니다: $url — '
      '--dart-define-from-file=env/prod.json을 넘겼는지 확인하세요',
    );
  }
}

/// 앱 시작 시 한 번 부른다.
void checkConfig() => checkApiBaseUrl(apiBaseUrl, release: kReleaseMode);
