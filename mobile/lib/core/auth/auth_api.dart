import '../api/api_client.dart';
import 'auth_user.dart';

/// 인증 API (SPEC_API §2). 아이디·비밀번호 로그인과 명단 확인 가입을 쓴다 —
/// 비밀번호 찾기 · 탈퇴는 웹으로 보낸다 (기획안 결정 D2), 카카오는 보류
class AuthApi {
  const AuthApi(this._client);

  final ApiClient _client;

  /// 가입 1단계 — 이름 · 생년월일 · 전화번호를 교회 명단과 대조한다 (§2.1).
  ///
  /// 불일치 · 명단 없음 · 이미 가입 · 너무 잦은 시도는 **모두 같은 `UNAUTHORIZED`**다
  /// (어느 칸이 틀렸는지 알려주지 않는다). 동명이인 2건 이상만 `VALIDATION_ERROR`
  Future<VerifiedRoster> verifyRoster({
    required String name,
    required String birthDate,
    required String phone,
  }) => _client.post(
    '/auth/verify-roster',
    body: {'name': name, 'birthDate': birthDate, 'phone': phone},
    decode: (data) => VerifiedRoster.fromJson(data as Map<String, dynamic>),
  );

  /// 가입 2단계 — 즉시 `MEMBER`가 된다 (승인 없음). **쿠키를 주지 않는다** —
  /// 가입 뒤에 로그인으로 보낸다 (§2.2). 만든 사람의 이름을 돌려준다
  Future<String> register({
    required String registrationToken,
    required String loginId,
    required String password,
  }) => _client.post(
    '/auth/register',
    body: {
      'registrationToken': registrationToken,
      'loginId': loginId,
      'password': password,
    },
    decode: (data) => (data as Map<String, dynamic>)['name'] as String,
  );

  /// 실패와 잠금(5회 실패 → 15분)은 똑같이 `UNAUTHORIZED`다 (§2.3)
  Future<AuthUser> login({required String loginId, required String password}) =>
      _client.post(
        '/auth/login',
        body: {'loginId': loginId, 'password': password},
        // 로그인 응답에는 loginId가 없다 — 방금 넣은 값이 곧 그 값이다
        decode: (data) => AuthUser.fromJson({
          ...data as Map<String, dynamic>,
          'loginId': loginId,
        }),
      );

  Future<AuthUser> me() => _client.get(
    '/auth/me',
    decode: (data) => AuthUser.fromJson(data as Map<String, dynamic>),
  );

  Future<void> logout() => _client.postNoContent('/auth/logout');

  /// 바뀐 내 정보를 돌려준다 (§2.10)
  Future<AuthUser> updatePhone(String phone) => _client.patch(
    '/auth/me',
    body: {'phone': phone},
    decode: (data) => AuthUser.fromJson(data as Map<String, dynamic>),
  );

  /// 현재 비밀번호가 틀리면 401이 아니라 **400 `VALIDATION_ERROR`, field `password`**다.
  /// 성공하면 다른 기기는 모두 로그아웃되고, 이 기기는 서버가 새 쿠키를 준다
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) => _client.postNoContent(
    '/auth/password/change',
    body: {'currentPassword': currentPassword, 'newPassword': newPassword},
  );
}
