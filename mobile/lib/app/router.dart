import 'package:go_router/go_router.dart';

import '../core/api/api_client.dart';
import '../features/church/location_screen.dart';
import '../features/church/welcome_screen.dart';
import '../features/church/worship_screen.dart';
import '../features/home/home_screen.dart';
import '../features/posts/news_screen.dart';
import '../features/posts/notice_detail_screen.dart';
import '../features/posts/post_summary.dart';
import '../features/posts/posts_api.dart';
import '../features/sermons/sermons_api.dart';
import '../features/sermons/sermons_screen.dart';
import 'app_shell.dart';
import 'coming_soon_screen.dart';
import 'paths.dart';

export 'paths.dart';

/// 앱 라우터. [openExternal]은 바깥 주소(YouTube · 지도 등)를 열 때 쓴다 —
/// 화면 밖의 일이라 앱(`app.dart`)이 넘겨준다
GoRouter buildRouter({
  required ApiClient api,
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
        builder: (context, state, shell) =>
            AppShell(shell: shell, openExternal: openExternal),
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
                    onFirstVisit: () => context.push(AppPaths.welcome),
                    onDirections: () => context.push(AppPaths.location),
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
          _comingSoonTab(
            AppPaths.resources,
            '자료',
            description: '주보 · 사진첩 · 월례회 자료 · 회의록은\n로그인한 회원만 볼 수 있어요.',
          ),
          _comingSoonTab(AppPaths.more, '더보기'),
        ],
      ),

      // ── 사이드바(☰)의 교회 안내 — 하단 탭을 덮고 뒤로가기로 닫힌다 ──
      GoRoute(
        path: AppPaths.welcome,
        builder: (context, state) => WelcomeScreen(
          onDirections: () => context.push(AppPaths.location),
          onRegister: () => context.push(AppPaths.newcomer),
          openExternal: openExternal,
        ),
      ),
      GoRoute(
        path: AppPaths.location,
        builder: (context, state) => LocationScreen(
          openExternal: openExternal,
          onFirstVisit: () => context.push(AppPaths.welcome),
        ),
      ),
      GoRoute(
        path: AppPaths.worship,
        builder: (context, state) => WorshipScreen(
          onDirections: () => context.push(AppPaths.location),
          onFirstVisit: () => context.push(AppPaths.welcome),
        ),
      ),
      _comingSoon(AppPaths.about, '청년교회 소개'),
      _comingSoon(AppPaths.organization, '조직도'),
      _comingSoon(AppPaths.newcomer, '새가족 등록'),
      _comingSoon(AppPaths.contact, '문의하기'),
    ],
  );
}

StatefulShellBranch _comingSoonTab(
  String path,
  String title, {
  String? description,
}) => StatefulShellBranch(
  routes: [
    GoRoute(
      path: path,
      builder: (context, state) =>
          ComingSoonScreen(title: title, description: description, tab: true),
    ),
  ],
);

GoRoute _comingSoon(String path, String title) => GoRoute(
  path: path,
  builder: (context, state) => ComingSoonScreen(title: title),
);
