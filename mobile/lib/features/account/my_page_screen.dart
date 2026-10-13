import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../core/auth/auth_state.dart';
import '../../core/auth/auth_user.dart';
import '../../core/config.dart';

/// 마이페이지 — 나와 앱 (기획안 §2-4 M10의 더보기 탭을 옮긴 것).
///
/// 하단 탭이 아니라 탭 화면 상단 오른쪽의 동그란 사람 버튼(`ProfileButton`)으로
/// 연다. 하단 탭을 덮고 뒤로가기로 닫힌다. 주소는 웹 마이페이지와 같은 `/my`다.
///
/// 교회 안내는 사이드바가 맡고, 여기는 **계정 · 설정 · 앱 정보**만 둔다.
/// 가입은 앱 안에서 한다. 탈퇴 · 관리는 앱에 만들지 않고 웹으로 보낸다.
class MyPageScreen extends StatelessWidget {
  const MyPageScreen({
    super.key,
    required this.onLogin,
    required this.onSignup,
    required this.onProfile,
    required this.onPasswordChange,
    required this.onContact,
    required this.openExternal,
  });

  final VoidCallback onLogin;
  final VoidCallback onSignup;
  final VoidCallback onProfile;
  final VoidCallback onPasswordChange;
  final VoidCallback onContact;
  final void Function(String url) openExternal;

  Future<void> _confirmLogout(BuildContext context, AuthState auth) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('로그아웃할까요?'),
        content: const Text('회원 공지와 자료는 다시 로그인해야 볼 수 있어요.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('취소'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('로그아웃'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await auth.logout();
    if (!context.mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(const SnackBar(content: Text('로그아웃했어요.')));
  }

  @override
  Widget build(BuildContext context) {
    final auth = AuthScope.of(context);
    final user = auth.user;
    final adminUrl = webUrl('/admin');

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          '마이페이지',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          if (user != null)
            _AccountCard(
              user,
              onProfile: onProfile,
              onPasswordChange: onPasswordChange,
              onLogout: () => _confirmLogout(context, auth),
            )
          else
            _GuestCard(onLogin: onLogin, onSignup: onSignup),
          const _GroupLabel('교회'),
          _Group(
            children: [
              ListTile(
                leading: const Icon(Icons.call_outlined),
                title: const Text('문의하기'),
                trailing: const Icon(Icons.chevron_right),
                onTap: onContact,
              ),
              // 관리 기능은 앱에 만들지 않는다 — 임원에게 웹으로 가는 길만 (기획안 §1)
              if (user != null && user.role.isLeader && adminUrl != null)
                ListTile(
                  leading: const Icon(Icons.admin_panel_settings_outlined),
                  title: const Text('관리 화면 (웹)'),
                  trailing: const Icon(Icons.open_in_new, size: 20),
                  onTap: () => openExternal(adminUrl),
                ),
            ],
          ),
          const _GroupLabel('앱'),
          _Group(
            children: [
              ListTile(
                leading: const Icon(Icons.description_outlined),
                title: const Text('오픈소스 라이선스'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () async {
                  final version = await _version();
                  if (!context.mounted) return;
                  showLicensePage(
                    context: context,
                    applicationName: 'LIGHT',
                    applicationVersion: version,
                  );
                },
              ),
              FutureBuilder(
                future: _version(),
                builder: (context, snapshot) => ListTile(
                  leading: const Icon(Icons.info_outline),
                  title: const Text('버전'),
                  trailing: Text(snapshot.data ?? ''),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// `1.0.0 (1)`. 못 읽으면 빈 문자열 — 버전 한 줄 때문에 화면이 깨질 일은 아니다
Future<String> _version() => PackageInfo.fromPlatform()
    .then((info) => '${info.version} (${info.buildNumber})')
    .catchError((_) => '');

class _AccountCard extends StatelessWidget {
  const _AccountCard(
    this.user, {
    required this.onProfile,
    required this.onPasswordChange,
    required this.onLogout,
  });

  final AuthUser user;
  final VoidCallback onProfile;
  final VoidCallback onPasswordChange;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return _Group(
      children: [
        ListTile(
          contentPadding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          leading: CircleAvatar(
            backgroundColor: theme.colorScheme.primary,
            foregroundColor: theme.colorScheme.onPrimary,
            // 이름 첫 글자 — 사진을 받지 않으니 이것으로 "내 계정"임을 알린다
            child: Text(user.name.characters.first),
          ),
          title: Text(
            user.name,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          subtitle: Text(user.role.label),
        ),
        ListTile(
          leading: const Icon(Icons.person_outline),
          title: const Text('내 정보'),
          trailing: const Icon(Icons.chevron_right),
          onTap: onProfile,
        ),
        // 카카오로 가입한 사람은 비밀번호가 없다 (SPEC_API §2.6 loginId == null)
        if (user.loginId != null)
          ListTile(
            leading: const Icon(Icons.lock_reset_outlined),
            title: const Text('비밀번호 변경'),
            trailing: const Icon(Icons.chevron_right),
            onTap: onPasswordChange,
          ),
        ListTile(
          leading: const Icon(Icons.logout),
          title: const Text('로그아웃'),
          onTap: onLogout,
        ),
      ],
    );
  }
}

class _GuestCard extends StatelessWidget {
  const _GuestCard({required this.onLogin, required this.onSignup});

  final VoidCallback onLogin;
  final VoidCallback onSignup;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return _Group(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                '로그인하면 회원 공지 · 주보 · 사진첩 · 월례회 자료를 볼 수 있어요.',
                style: theme.textTheme.bodyLarge,
              ),
              const SizedBox(height: 16),
              // 지난 로그인을 확인하는 중에도 막지 않는다 — 서버가 잠들어 있으면
              // 1분 가까이 걸린다. 그 사이 로그인해도 늦게 끝난 확인이 덮어쓰지 않는다
              FilledButton(onPressed: onLogin, child: const Text('로그인')),
              const SizedBox(height: 8),
              OutlinedButton(onPressed: onSignup, child: const Text('회원가입')),
            ],
          ),
        ),
      ],
    );
  }
}

class _GroupLabel extends StatelessWidget {
  const _GroupLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 24, 4, 8),
      child: Text(
        label,
        style: theme.textTheme.labelLarge?.copyWith(
          color: theme.colorScheme.onSurfaceVariant,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

/// 설정 목록 한 묶음 — 카드 안에 줄을 세우고 사이에 구분선
class _Group extends StatelessWidget {
  const _Group({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (final (i, child) in children.indexed) ...[
            if (i > 0) const Divider(height: 1, indent: 16, endIndent: 16),
            child,
          ],
        ],
      ),
    );
  }
}
