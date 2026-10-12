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
  static const more = '/more';

  // 자료 — 하단 탭을 덮는 전체 화면 뷰어
  static const bulletin = '/bulletin';
  static const meeting = '/meeting';

  // 계정 — 하단 탭을 덮고 열린다
  static const login = '/login';

  // 사이드바 — 교회 안내
  static const welcome = '/welcome';
  static const location = '/location';
  static const worship = '/worship';
  static const about = '/about';
  static const organization = '/organization';
  static const newcomer = '/newcomer';
  static const contact = '/contact';
}
