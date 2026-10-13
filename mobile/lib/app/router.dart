import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../core/api/api_client.dart';
import '../core/auth/auth_api.dart';
import '../core/auth/auth_state.dart';
import '../features/account/login_screen.dart';
import '../features/account/my_page_screen.dart';
import '../features/account/password_change_screen.dart';
import '../features/account/profile_screen.dart';
import '../features/bulletins/bulletin_viewer_screen.dart';
import '../features/bulletins/bulletins_api.dart';
import '../features/bulletins/bulletins_screen.dart';
import '../features/church/about_screen.dart';
import '../features/church/contact_screen.dart';
import '../features/church/location_screen.dart';
import '../features/church/welcome_screen.dart';
import '../features/church/worship_screen.dart';
import '../features/home/home_screen.dart';
import '../features/meetings/meeting_viewer_screen.dart';
import '../features/meetings/meetings_api.dart';
import '../features/meetings/meetings_screen.dart';
import '../features/newcomers/newcomer_form_screen.dart';
import '../features/newcomers/newcomers_api.dart';
import '../features/photos/album.dart';
import '../features/photos/album_screen.dart';
import '../features/photos/albums_screen.dart';
import '../features/photos/photos_api.dart';
import '../features/posts/news_screen.dart';
import '../features/posts/notice_detail_screen.dart';
import '../features/posts/post_summary.dart';
import '../features/posts/posts_api.dart';
import '../features/posts/posts_list_screen.dart';
import '../features/resources/resources_screen.dart';
import '../features/sermons/sermons_api.dart';
import '../features/sermons/sermons_screen.dart';
import 'app_shell.dart';
import 'coming_soon_screen.dart';
import 'paths.dart';

export 'paths.dart';

/// 앱 라우터. [openExternal]은 바깥 주소(YouTube · 지도 등)를 열 때 쓴다 —
/// 화면 밖의 일이라 앱(`app.dart`)이 넘겨준다.
///
/// 로그인 상태([auth])에 따라 내용이 달라지는 화면은 [ListenableBuilder]로
/// 감싼다 — 로그인·로그아웃하면 그 화면이 새 상태로 다시 만들어진다.
GoRouter buildRouter({
  required ApiClient api,
  required AuthState auth,
  required Future<void> Function(String url) openExternal,
}) {
  final posts = PostsApi(api);
  final sermons = SermonsApi(api);
  final newcomers = NewcomersApi(api);
  final bulletins = BulletinsApi(api);
  final meetings = MeetingsApi(api);
  final photos = PhotosApi(api);
  final authApi = AuthApi(api);

  /// 공지 상세. 홈과 소식 두 탭에서 열린다 — 화면은 하나, 주소만 탭마다 다르다.
  /// 목록이 slug 대신 id로 연다: slug에는 한글이 올 수 있어 주소 인코딩을
  /// 신경 써야 하고, 서버는 둘 다 받는다 (SPEC_API §3.3)
  ///
  /// 로그인한 사람이 바뀌면 화면을 새로 만들어 다시 받는다. 로그인 안내를 보고
  /// 로그인하고 돌아오면 그 자리에서 회원 공지가 열린다 (기획안 §2-5 "원래 화면 복귀")
  ///
  /// 회의록 · 예산안 상세도 같은 화면이다 — [title]만 다르다 (기획안 M9)
  GoRoute noticeDetail(String path, {String title = '공지'}) => GoRoute(
    path: path,
    builder: (context, state) => ListenableBuilder(
      listenable: auth,
      builder: (context, _) => NoticeDetailScreen(
        key: ValueKey(auth.user?.id),
        posts: posts,
        idOrSlug: state.pathParameters['id']!,
        openExternal: openExternal,
        onLogin: () => context.push(AppPaths.login),
        title: title,
      ),
    ),
  );

  /// 회의록 · 예산안 목록 + 상세 (`/resources/<분류>` · `/resources/<분류>/:id`)
  GoRoute postsOf(Resource resource, PostCategory category, String empty) {
    final path = _resourcePaths[resource]!;
    final title = _resourceTitles[resource]!;
    return GoRoute(
      path: path,
      builder: (context, state) => PostsListScreen(
        posts: posts,
        category: category,
        title: title,
        emptyMessage: empty,
        onOpen: (post) =>
            context.push('${AppPaths.resources}/$path/${post.id}'),
        onLogin: () => context.push(AppPaths.login),
      ),
      routes: [noticeDetail(':id', title: title)],
    );
  }

  /// 로그인 · 회원가입 — 한 화면이고 처음 보여줄 칸만 다르다
  LoginScreen loginScreen(BuildContext context, AuthMode mode) => LoginScreen(
    auth: auth,
    signupApi: authApi,
    initialMode: mode,
    // 연 화면으로 돌아간다. 그 화면은 로그인 상태로 다시 그려진다
    onDone: () => context.canPop() ? context.pop() : context.go(AppPaths.home),
    onFirstVisit: () => context.push(AppPaths.welcome),
    openExternal: openExternal,
  );

  return GoRouter(
    initialLocation: AppPaths.home,
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => AppShell(
          shell: shell,
          openExternal: openExternal,
          onLogin: () => context.push(AppPaths.login),
        ),
        // 순서가 하단 탭 순서다 (`appTabs`)
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppPaths.home,
                builder: (context, state) => HomeScreen(
                  posts: posts,
                  sermons: sermons,
                  bulletins: bulletins,
                  actions: HomeActions(
                    onSeeAllNotices: () => context.go(AppPaths.news),
                    onSeeAllSermons: () => context.go(AppPaths.sermons),
                    onOpenSermon: (sermon) => openExternal(sermon.youtubeUrl),
                    // 홈 탭 안에서 연다 — 뒤로가기가 홈으로 돌아온다
                    onOpenNotice: (notice) =>
                        context.push('${AppPaths.home}/news/${notice.id}'),
                    onFirstVisit: () => context.push(AppPaths.welcome),
                    onDirections: () => context.push(AppPaths.location),
                    onOpenBulletin: (id) =>
                        context.push('${AppPaths.bulletin}/$id'),
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
                builder: (context, state) => ListenableBuilder(
                  listenable: auth,
                  builder: (context, _) => NewsScreen(
                    posts: posts,
                    // 회원 공지는 로그인했을 때만 부른다 — 비로그인이면 401이다
                    categories: [
                      PostCategory.noticePublic,
                      if (auth.isLoggedIn) PostCategory.noticeMember,
                    ],
                    onOpen: (notice) =>
                        context.push('${AppPaths.news}/${notice.id}'),
                    onLogin: () => context.push(AppPaths.login),
                  ),
                ),
                routes: [noticeDetail(':id')],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppPaths.resources,
                builder: (context, state) => ResourcesScreen(
                  meetings: meetings,
                  onLogin: () => context.push(AppPaths.login),
                  onOpen: (resource) => context.push(
                    '${AppPaths.resources}/${_resourcePaths[resource]}',
                  ),
                  openExternal: openExternal,
                ),
                routes: [
                  GoRoute(
                    path: _resourcePaths[Resource.bulletins]!,
                    builder: (context, state) => BulletinsScreen(
                      bulletins: bulletins,
                      onOpen: (b) =>
                          context.push('${AppPaths.bulletin}/${b.id}'),
                      onLogin: () => context.push(AppPaths.login),
                    ),
                  ),
                  GoRoute(
                    path: _resourcePaths[Resource.photos]!,
                    builder: (context, state) => AlbumsScreen(
                      photos: photos,
                      // 앨범 하나를 주는 API가 없어 제목을 목록에서 넘겨준다
                      onOpen: (album) => context.push(
                        '${AppPaths.resources}/${_resourcePaths[Resource.photos]}/${album.id}',
                        extra: album,
                      ),
                      onLogin: () => context.push(AppPaths.login),
                    ),
                    routes: [
                      GoRoute(
                        path: ':id',
                        builder: (context, state) => AlbumScreen(
                          photos: photos,
                          albumId: state.pathParameters['id']!,
                          album: state.extra is Album
                              ? state.extra! as Album
                              : null,
                          onLogin: () => context.push(AppPaths.login),
                        ),
                      ),
                    ],
                  ),
                  GoRoute(
                    path: _resourcePaths[Resource.meetings]!,
                    builder: (context, state) => MeetingsScreen(
                      meetings: meetings,
                      onOpen: (m) =>
                          context.push('${AppPaths.meeting}/${m.id}'),
                      onLogin: () => context.push(AppPaths.login),
                    ),
                  ),
                  postsOf(
                    Resource.minutes,
                    PostCategory.minutes,
                    '아직 올라온 회의록이 없어요.',
                  ),
                  // 예산안은 임원 이상 — 자료 탭이 회원에게는 카드를 보이지 않는다
                  postsOf(
                    Resource.budget,
                    PostCategory.budget,
                    '아직 올라온 예산안이 없어요.',
                  ),
                ],
              ),
            ],
          ),
        ],
      ),

      // ── 마이페이지 — 탭 화면 상단 오른쪽 사람 버튼으로 연다. 하단 탭을 덮는다 ──
      GoRoute(
        path: AppPaths.my,
        builder: (context, state) => MyPageScreen(
          onLogin: () => context.push(AppPaths.login),
          onSignup: () => context.push(AppPaths.signup),
          onProfile: () => context.push('${AppPaths.my}/profile'),
          onPasswordChange: () => context.push('${AppPaths.my}/password'),
          onContact: () => context.push(AppPaths.contact),
          openExternal: openExternal,
        ),
        routes: [
          GoRoute(
            path: 'profile',
            builder: (context, state) => ProfileScreen(
              auth: auth,
              onLogin: () => context.push(AppPaths.login),
              openExternal: openExternal,
            ),
          ),
          GoRoute(
            path: 'password',
            builder: (context, state) =>
                PasswordChangeScreen(auth: auth, onDone: () => context.pop()),
          ),
        ],
      ),

      // ── 자료 뷰어 — 하단 탭을 덮는다 ──
      GoRoute(
        path: '${AppPaths.bulletin}/:id',
        builder: (context, state) => BulletinViewerScreen(
          bulletins: bulletins,
          id: state.pathParameters['id']!,
          onLogin: () => context.push(AppPaths.login),
        ),
      ),

      GoRoute(
        path: '${AppPaths.meeting}/:id',
        builder: (context, state) => MeetingViewerScreen(
          meetings: meetings,
          id: state.pathParameters['id']!,
          onLogin: () => context.push(AppPaths.login),
        ),
      ),

      // ── 계정 ──
      GoRoute(
        path: AppPaths.login,
        builder: (context, state) => loginScreen(context, AuthMode.login),
      ),
      // 마이페이지의 [회원가입] — 같은 화면을 회원가입 칸으로 연다
      GoRoute(
        path: AppPaths.signup,
        builder: (context, state) => loginScreen(context, AuthMode.signup),
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
      GoRoute(
        path: AppPaths.about,
        builder: (context, state) => const AboutScreen(),
      ),
      // 웹도 섬기는 사람들 정보가 모두 ❓(확인 필요)다. 정해지면 채운다
      _comingSoon(
        AppPaths.organization,
        '조직도',
        description: '섬기는 사람들을 정리하고 있어요.',
      ),
      GoRoute(
        path: AppPaths.newcomer,
        builder: (context, state) => NewcomerFormScreen(
          api: newcomers,
          // 등록을 마친 화면은 바꿔 끼운다 — 뒤로가기로 빈 완료 화면에 돌아오지 않게
          onDirections: () => context.pushReplacement(AppPaths.location),
        ),
      ),
      GoRoute(
        path: AppPaths.contact,
        builder: (context, state) => ContactScreen(
          openExternal: openExternal,
          onFirstVisit: () => context.push(AppPaths.welcome),
          onDirections: () => context.push(AppPaths.location),
        ),
      ),
    ],
  );
}

GoRoute _comingSoon(String path, String title, {String? description}) =>
    GoRoute(
      path: path,
      builder: (context, state) =>
          ComingSoonScreen(title: title, description: description),
    );

/// 자료 탭 아래 주소 (`/resources/<이것>`)
const _resourcePaths = {
  Resource.bulletins: 'bulletins',
  Resource.photos: 'photos',
  Resource.meetings: 'meetings',
  Resource.minutes: 'minutes',
  Resource.budget: 'budget',
};

const _resourceTitles = {
  Resource.bulletins: '주보',
  Resource.photos: '사진첩',
  Resource.meetings: '월례회 자료',
  Resource.minutes: '회의록',
  Resource.budget: '예산안',
};
