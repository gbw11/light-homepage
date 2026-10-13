/// 권한 (SPEC_API §1.5). 계단식 — 위 단계는 아래 단계의 권한을 모두 가진다
enum Role {
  guest('GUEST', '손님'),
  member('MEMBER', '일반 회원'),
  leader('LEADER', '임원'),
  pastor('PASTOR', '목회자');

  const Role(this.wire, this.label);

  final String wire;

  /// 화면 표기 — 웹 `ProfileInfo.tsx`의 `ROLE_LABELS`와 같다 (WIREFRAME §14-2)
  final String label;

  /// 모르는 값은 가장 낮은 권한으로 본다 — 높게 보면 없는 권한을 화면이 약속한다
  static Role parse(String? raw) =>
      values.firstWhere((r) => r.wire == raw, orElse: () => Role.guest);

  /// 임원 이상 — 예산안 · "관리는 웹에서"가 보인다 (기획안 §5)
  bool get isLeader => index >= Role.leader.index;
}

/// 로그인한 사람 (SPEC_API §2.3 · §2.6)
class AuthUser {
  const AuthUser({
    required this.id,
    required this.name,
    required this.role,
    this.loginId,
    this.phone,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
    id: json['id'] as String,
    name: json['name'] as String,
    role: Role.parse(json['role'] as String?),
    loginId: json['loginId'] as String?,
    phone: json['phone'] as String?,
  );

  final String id;
  final String name;
  final Role role;

  /// 카카오로 가입했으면 null — 비밀번호가 없어 비밀번호 변경을 숨긴다
  final String? loginId;
  final String? phone;

  AuthUser copyWith({String? phone}) => AuthUser(
    id: id,
    name: name,
    role: role,
    loginId: loginId,
    phone: phone ?? this.phone,
  );
}

/// 가입 1단계(명단 확인)를 통과한 결과 (SPEC_API §2.1)
class VerifiedRoster {
  const VerifiedRoster({
    required this.registrationToken,
    required this.name,
    required this.expiresIn,
  });

  factory VerifiedRoster.fromJson(Map<String, dynamic> json) => VerifiedRoster(
    registrationToken: json['registrationToken'] as String,
    name: json['name'] as String,
    expiresIn: json['expiresIn'] as int,
  );

  /// 1회용 · [expiresIn]초 뒤 만료 — 2단계(계정 만들기)에만 쓴다
  final String registrationToken;

  /// 명단의 이름 (동명이인 접미사 포함, 예: `김도연a`)
  final String name;
  final int expiresIn;
}
