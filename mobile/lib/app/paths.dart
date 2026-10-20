/// 화면 주소.
///
/// 하단 탭은 탭 하나가 주소 하나다. 사이드바(☰)의 교회 안내 화면은 탭 밖에서
/// 열린다 — 하단 탭을 덮고 뒤로가기로 닫힌다. 주소를 웹과 맞춰 두어서, 나중에
/// 웹 링크를 앱으로 여는 날(딥링크)에 그대로 쓸 수 있다.
abstract final class AppPaths {
  // 하단 탭
  static const home = '/home';
  static const sermons = '/sermons';
  static const news = '/news';
  static const resources = '/resources';

  // 자료 — 하단 탭을 덮는 전체 화면 뷰어
  static const bulletin = '/bulletin';
  static const meeting = '/meeting';

  // 자료 올리기 — 임원 이상. 하단 탭을 덮는다.
  // `/bulletin/:id` 아래에 두면 'upload'가 id로 잡힌다 — 따로 둔다
  static const uploadBulletin = '/upload/bulletin';
  static const uploadMeeting = '/upload/meeting';

  /// 글 쓰기 — `?c=notice` · `minutes` · `budget`
  static const writePost = '/write';

  // 계정 — 하단 탭을 덮고 열린다
  static const login = '/login';
  static const signup = '/signup';

  /// 마이페이지 (웹과 같은 주소) — 탭 화면 상단 오른쪽 사람 버튼으로 연다
  static const my = '/my';

  /// 알림함 — 홈 상단의 종으로 연다. 하단 탭을 덮는다
  static const notifications = '/notifications';

  // 사이드바 — 교회 안내
  static const welcome = '/welcome';
  static const location = '/location';
  static const worship = '/worship';
  static const about = '/about';
  static const organization = '/organization';
  static const newcomer = '/newcomer';
  static const contact = '/contact';
}
