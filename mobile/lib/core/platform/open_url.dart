/// [url]을 열고, 못 열었는데 [fallbacks]에 대신 열 주소가 있으면 그것을 연다.
///
/// 지도 앱처럼 `kakaomap://` 같은 앱 주소를 먼저 열어 보고, 앱이 없으면 웹
/// 주소로 넘어갈 때 쓴다. [launch]는 실제로 여는 함수(url_launcher)다 —
/// 열지 못하면 false를 준다. 둘 다 못 열면 false
Future<bool> openWithFallback(
  String url, {
  required Future<bool> Function(String url) launch,
  Map<String, String> fallbacks = const {},
}) async {
  if (await launch(url)) return true;
  final fallback = fallbacks[url];
  return fallback != null && await launch(fallback);
}
