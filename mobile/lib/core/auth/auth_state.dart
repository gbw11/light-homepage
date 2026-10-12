import 'dart:async';

import 'package:flutter/widgets.dart';

import '../api/api_client.dart';
import '../api/api_error.dart';
import 'auth_api.dart';
import 'auth_user.dart';

/// 앱 전체가 함께 보는 로그인 상태 (기획안 §2-5).
///
/// 소식 탭(회원 공지) · 사이드바 머리 · 더보기 탭 · 회원 화면의 로그인 게이트가
/// 모두 이 하나를 본다. 토큰은 다루지 않는다 — 쿠키는 [ApiClient]가 들고 있고,
/// 여기는 "누가 로그인해 있나"만 안다.
class AuthState extends ChangeNotifier {
  AuthState(this._client) : _api = AuthApi(_client) {
    _expiry = _client.sessionExpired.listen((_) => _onSessionExpired());
  }

  final ApiClient _client;
  final AuthApi _api;
  late final StreamSubscription<void> _expiry;

  AuthUser? _user;
  var _restoring = true;

  /// 로그인 · 로그아웃마다 늘어난다. 앱 시작의 확인([restore])이 늦게 끝났을 때
  /// 그 사이에 바뀐 상태를 옛 결과로 덮어쓰지 않으려고 쓴다
  var _version = 0;

  /// 로그인해 있지 않으면 null
  AuthUser? get user => _user;
  bool get isLoggedIn => _user != null;

  /// 앱을 켜고 지난 로그인을 확인하는 중. 그동안은 로그인 안 한 것처럼 그린다
  bool get restoring => _restoring;

  /// 로그인해 있던 세션이 끊겼다 (리프레시 토큰까지 만료). 앱이 안내 문구를 띄운다
  Stream<void> get sessionEnded => _sessionEnded.stream;
  final _sessionEnded = StreamController<void>.broadcast();

  /// 확인에 실패했을 때 다시 묻는 간격. 오프라인 · 서버가 깨어나는 중일 수 있다
  static const restoreRetryDelays = [
    Duration(seconds: 5),
    Duration(seconds: 20),
    Duration(seconds: 60),
  ];
  Timer? _restoreRetry;
  var _restoreAttempts = 0;

  /// 앱을 켤 때 한 번 — 쿠키가 살아 있으면 그대로 로그인 상태가 된다.
  ///
  /// **앱 시작을 막지 않는다** — Render 서버가 잠들어 있으면 1분 가까이 걸린다.
  ///
  /// 로그인 안 한 상태로 **확정하는 것은 401뿐이다**(로그인한 적 없음 · 만료).
  /// 오프라인 · 서버 오류로 실패하면 쿠키는 살아 있을 수 있으니 잠시 뒤 다시
  /// 묻는다 — 그러지 않으면 켜는 순간 네트워크가 잠깐 끊겼다는 이유로 로그인이
  /// 풀린 것처럼 보이고, 앱을 다시 켤 때까지 그대로다.
  Future<void> restore() async {
    _restoreRetry?.cancel();
    final version = _version;
    AuthUser? me;
    var retry = false;
    try {
      me = await _api.me();
    } on ApiError catch (error) {
      retry = error.code != ErrorCode.unauthorized;
    } catch (_) {
      retry = true;
    }
    _restoring = false;
    // 그 사이 로그인 · 로그아웃했다 — 그쪽이 맞다. 이 결과는 버린다
    if (version != _version) {
      notifyListeners();
      return;
    }
    _user = me;
    notifyListeners();
    if (retry && _restoreAttempts < restoreRetryDelays.length) {
      _restoreRetry = Timer(restoreRetryDelays[_restoreAttempts++], restore);
    }
  }

  /// 실패하면 [ApiError]를 그대로 던진다 — 문구는 로그인 화면이 정한다
  Future<void> login({
    required String loginId,
    required String password,
  }) async {
    _user = await _api.login(loginId: loginId, password: password);
    _restoreRetry?.cancel();
    _version++;
    notifyListeners();
  }

  /// 서버에 알리고, 기기 쪽 쿠키도 비운다. 서버가 응답하지 않아도 로그아웃은 된다 —
  /// 로그아웃을 눌렀는데 로그인이 남아 있는 것이 더 나쁜 실패다
  Future<void> logout() async {
    try {
      await _api.logout();
    } catch (_) {
      // 위 주석
    }
    await _client.clearCookies();
    _user = null;
    _version++;
    notifyListeners();
  }

  Future<void> updatePhone(String phone) async {
    _user = await _api.updatePhone(phone);
    notifyListeners();
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) => _api.changePassword(
    currentPassword: currentPassword,
    newPassword: newPassword,
  );

  /// 내 정보를 서버에서 다시 받는다 (내 정보 화면을 열 때)
  Future<AuthUser> refreshMe() async {
    final me = await _api.me();
    _user = me;
    notifyListeners();
    return me;
  }

  void _onSessionExpired() {
    // 로그인한 적 없는 사람의 401도 리프레시 실패로 이어진다(앱 시작의 /auth/me 등).
    // 그때는 끊길 세션이 없었으니 알리지 않는다
    if (_user == null) return;
    _user = null;
    _version++;
    notifyListeners();
    _sessionEnded.add(null);
  }

  @override
  void dispose() {
    _restoreRetry?.cancel();
    _expiry.cancel();
    _sessionEnded.close();
    super.dispose();
  }
}

/// [AuthState]를 아래 화면들에 건넨다. `AuthScope.of(context)`로 꺼내면 로그인
/// 상태가 바뀔 때 그 화면이 다시 그려진다
class AuthScope extends InheritedNotifier<AuthState> {
  const AuthScope({super.key, required AuthState auth, required super.child})
    : super(notifier: auth);

  static AuthState of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<AuthScope>()!.notifier!;

  /// 화면만 따로 띄울 때(테스트 등) [AuthScope]가 없을 수 있다
  static AuthState? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<AuthScope>()?.notifier;
}
