import 'package:go_router/go_router.dart';

import '../core/api/api_client.dart';
import '../features/home/home_screen.dart';
import '../features/posts/news_screen.dart';
import '../features/posts/notice_detail_screen.dart';
import '../features/posts/post_summary.dart';
import '../features/posts/posts_api.dart';
import '../features/sermons/sermons_api.dart';
import '../features/sermons/sermons_screen.dart';
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

  /// 공지 상세. 홈과 소식 두 탭에서 열린다 — 화면은 하나, 주소만 탭마다 다르다.
  /// 목록이 slug 대신 id로 연다: slug에는 한글이 올 수 있어 주소 인코딩을
  /// 신경 써야 하고, 서버는 둘 다 받는다 (SPEC_API §3.3)
  GoRoute noticeDetail(String path) => GoRoute(
    path: path,
    builder: (context, state) => NoticeDetailScreen(
      posts: posts,
      idOrSlug: state.pathParameters['id']!,
      openExternal: openExternal,
    ),
  );

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
                    // 홈 탭 안에서 연다 — 뒤로가기가 홈으로 돌아온다
                    onOpenNotice: (notice) =>
                        context.push('${AppPaths.home}/news/${notice.id}'),
                    // 처음 오시는 분 · 오시는 길은 아직 없다
                    onFirstVisit: notReady,
                    onDirections: notReady,
                  ),
                ),
                routes: [noticeDetail('news/:id')],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppPaths.sermons,
                builder: (context, state) =>
                    SermonsScreen(sermons: sermons, openExternal: openExternal),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppPaths.news,
                builder: (context, state) => NewsScreen(
                  posts: posts,
                  // 로그인(묶음 A)이 생기면 로그인했을 때 회원 공지를 더한다
                  categories: const [PostCategory.noticePublic],
                  onOpen: (notice) =>
                      context.push('${AppPaths.news}/${notice.id}'),
                ),
                routes: [noticeDetail(':id')],
              ),
            ],
          ),
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
