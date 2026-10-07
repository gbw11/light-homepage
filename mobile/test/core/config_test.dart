import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/core/config.dart';

void main() {
  group('checkApiBaseUrl', () {
    test('release에서 https 주소는 통과한다', () {
      expect(
        () => checkApiBaseUrl(
          'https://light-homepage.onrender.com/api',
          release: true,
        ),
        returnsNormally,
      );
    });

    test('release에서 에뮬레이터 기본값이면 실패한다', () {
      expect(
        () => checkApiBaseUrl('http://10.0.2.2:8080/api', release: true),
        throwsStateError,
      );
    });

    test('debug에서는 http 로컬 주소를 허용한다', () {
      expect(
        () => checkApiBaseUrl('http://10.0.2.2:8080/api', release: false),
        returnsNormally,
      );
    });
  });
}
