import '../api/api_client.dart';

/// 푸시를 받을 기기 등록 · 해제 (SPEC_API §15.2, 로그인 필요).
///
/// 공개 알림(주제 `public`)은 등록 없이 받는다. 이 등록은 회원 공지 · 새가족 신청처럼
/// **로그인한 사람에게만** 가는 알림용이다.
class DevicesApi {
  const DevicesApi(this._client);

  final ApiClient _client;

  /// 멱등 — 앱을 켤 때 · 로그인할 때 · 토큰이 바뀔 때마다 불러도 한 줄이다
  Future<void> register(String token) => _client.postNoContent(
    '/me/devices',
    body: {'token': token, 'platform': 'ANDROID'},
  );

  /// 로그아웃 **전에** 부른다 (뒤에는 로그인이 없어 401). 내 기기만 지운다
  Future<void> unregister(String token) =>
      _client.delete('/me/devices/${Uri.encodeComponent(token)}');
}
