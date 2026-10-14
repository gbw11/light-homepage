import 'package:flutter_test/flutter_test.dart';
import 'package:light_mobile/core/platform/open_url.dart';

void main() {
  const fallbacks = {'kakaomap://x': 'https://map.kakao.com/x'};

  Future<(bool, List<String>)> open(String url, Set<String> openable) async {
    final tried = <String>[];
    final opened = await openWithFallback(
      url,
      fallbacks: fallbacks,
      launch: (u) async {
        tried.add(u);
        return openable.contains(u);
      },
    );
    return (opened, tried);
  }

  test('앱이 있으면 앱 주소로 열고 웹은 열지 않는다', () async {
    final (opened, tried) = await open('kakaomap://x', {'kakaomap://x'});
    expect(opened, isTrue);
    expect(tried, ['kakaomap://x']);
  });

  test('앱이 없으면 웹 주소로 다시 연다', () async {
    final (opened, tried) = await open('kakaomap://x', {
      'https://map.kakao.com/x',
    });
    expect(opened, isTrue);
    expect(tried, ['kakaomap://x', 'https://map.kakao.com/x']);
  });

  test('대신 열 주소가 없는 주소는 한 번만 시도한다', () async {
    final (opened, tried) = await open('https://youtu.be/a', {});
    expect(opened, isFalse);
    expect(tried, ['https://youtu.be/a']);
  });

  test('웹 주소도 못 열면 false', () async {
    final (opened, _) = await open('kakaomap://x', {});
    expect(opened, isFalse);
  });
}
