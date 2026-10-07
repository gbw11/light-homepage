import 'package:go_router/go_router.dart';

import '../core/api/api_client.dart';
import '../features/home/home_screen.dart';
import '../features/posts/posts_api.dart';
import '../features/sermons/sermons_api.dart';
import 'app_shell.dart';
import 'coming_soon_screen.dart';

/// 화면 주소. 하단 탭 하나가 주소 하나다
abstract final class AppPaths {
  static const home = '/home';
  static const sermons = '/sermons';
  static const news = '/news';
  static const resources = '/resources';
  static const more = '/more';
}

/// 앱 라우터. [notReady]는 아직 없는 화면을 눌렀을 때, [openExternal]은 바깥 주소
/// (YouTube 등)를 열 때 쓴다 — 둘 다 화면 밖의 일이라 앱(`app.dart`)이 넘겨준다
GoRouter buildRouter({
  required ApiClient api,
  required void Function() notReady,
  required Future<void> Function(String url) openExternal,
}) {
  final posts = PostsApi(api);
  final sermons = SermonsApi(api);

  return GoRouter(
    initialLocation: AppPaths.home,
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => AppShell(shell: shell),
        // 순서가 하단 탭 순서다 (`appTabs`)
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppPaths.home,
                builder: (context, state) => HomeScreen(
                  posts: posts,
                  sermons: sermons,
                  actions: HomeActions(
                    onSeeAllNotices: () => context.go(AppPaths.news),
                    onSeeAllSermons: () => context.go(AppPaths.sermons),
                    onOpenSermon: (sermon) => openExternal(sermon.youtubeUrl),
                    // 공지 상세 · 처음 오시는 분 · 오시는 길은 아직 없다
                    onOpenNotice: (_) => notReady(),
                    onFirstVisit: notReady,
                    onDirections: notReady,
                  ),
                ),
              ),
            ],
          ),
          _comingSoon(AppPaths.sermons, '말씀'),
          _comingSoon(AppPaths.news, '소식'),
          _comingSoon(
            AppPaths.resources,
            '자료',
            description: '주보 · 사진첩 · 월례회 자료 · 회의록은\n로그인한 회원만 볼 수 있어요.',
          ),
          _comingSoon(AppPaths.more, '더보기'),
        ],
      ),
    ],
  );
}

StatefulShellBranch _comingSoon(
  String path,
  String title, {
  String? description,
}) => StatefulShellBranch(
  routes: [
    GoRoute(
      path: path,
      builder: (context, state) =>
          ComingSoonScreen(title: title, description: description),
    ),
  ],
);
