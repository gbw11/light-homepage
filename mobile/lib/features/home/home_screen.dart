import 'package:flutter/material.dart';

import '../../core/auth/auth_state.dart';
import '../../core/format/date_format.dart';
import '../../core/ui/menu_button.dart';
import '../../core/ui/profile_button.dart';
import '../bulletins/bulletin.dart';
import '../bulletins/bulletins_api.dart';
import '../posts/post_card.dart';
import '../posts/post_summary.dart';
import '../posts/posts_api.dart';
import '../sermons/sermon.dart';
import '../sermons/sermons_api.dart';
import '../sermons/video_thumbnail.dart';
import 'bulletin_carousel.dart';

/// 홈에서 다른 곳으로 가는 길. 화면 이동은 홈이 정하지 않고 바깥(탭 틀)이 정한다
class HomeActions {
  const HomeActions({
    required this.onFirstVisit,
    required this.onDirections,
    required this.onOpenNotice,
    required this.onSeeAllNotices,
    required this.onOpenSermon,
    required this.onSeeAllSermons,
    required this.onOpenBulletin,
  });

  final VoidCallback onFirstVisit;
  final VoidCallback onDirections;
  final void Function(PostSummary notice) onOpenNotice;
  final VoidCallback onSeeAllNotices;
  final void Function(Sermon sermon) onOpenSermon;
  final VoidCallback onSeeAllSermons;

  /// 주보 id
  final void Function(String id) onOpenBulletin;
}

/// 홈 (웹 `/home`을 앱에 맞게 줄인 것).
///
/// 앱을 여는 사람은 대부분 이미 다니는 회원이라 **이번 주 소식과 말씀**만 둔다.
/// 웹 홈의 「우리는」·「주일에는 이렇게 모입니다」는 더보기 탭으로 가고, 맨 아래
/// 「처음 오시나요?」는 맨 위 버튼과 겹쳐서 뺐다.
///
/// 맨 위는 웹과 같은 원칙을 지킨다 — **스크롤 없이 예배 시간 + 장소 + 다음 행동이
/// 모두 보인다** (WIREFRAME §1).
///
/// 그 아래가 예배 사진을 깐 소개 카드다 — 한 줄 소개 · 예배 시간 · 장소 · 버튼 2개.
/// 로그인한 회원에게는 그 위에 **최신 주보**가 더 있다 — 임원이 매주 올리면 따라
/// 바뀌고, 장을 2초마다 넘긴다 ([BulletinCarousel]). 주보는 회원 전용이라
/// (SPEC_API §5, 비로그인 401) 비로그인 · 주보 없음 · 실패에는 카드만 있다.
class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.posts,
    required this.sermons,
    required this.bulletins,
    required this.actions,
  });

  final PostsApi posts;
  final SermonsApi sermons;
  final BulletinsApi bulletins;
  final HomeActions actions;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

/// 웹 홈과 같은 개수
const _noticeCount = 3;

class _HomeScreenState extends State<HomeScreen> {
  late Future<List<PostSummary>> _notices;
  late Future<Sermon?> _sermon;

  /// 최신 주보. 비로그인 · 없음 · 실패면 null — 예배 사진이 대신 선다
  Bulletin? _bulletin;
  String? _bulletinFor;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // 로그인한 사람이 바뀌면(로그인 · 로그아웃) 다시 묻는다
    final userId = AuthScope.maybeOf(context)?.user?.id;
    if (userId != _bulletinFor) {
      _bulletinFor = userId;
      _bulletin = null;
      if (userId != null) _loadBulletin();
    }
  }

  Future<void> _loadBulletin() async {
    final userId = _bulletinFor;
    try {
      final bulletin = await widget.bulletins.latest();
      // 기다리는 사이 로그아웃했으면 버린다
      if (mounted && userId == _bulletinFor) {
        setState(() => _bulletin = bulletin);
      }
    } catch (_) {
      // 그림 하나 때문에 화면에 오류를 띄우지 않는다 — 사진이 그대로 선다
    }
  }

  void _load() {
    _notices = widget.posts
        .list(category: PostCategory.noticePublic, size: _noticeCount)
        .then((page) => page.items);
    // 설교는 없거나 실패하면 칸 자체를 숨긴다 (웹과 같다) — 그래서 에러를 null로 삼킨다.
    // 서버는 YouTube 실패를 빈 목록이나 502로 주는데(SPEC_API §9.2) 둘 다 "영상 없음"이다
    _sermon = widget.sermons
        .list(size: 1)
        .then((page) => page.items.firstOrNull)
        .catchError((_) => null);
  }

  Future<void> _refresh() async {
    setState(_load);
    // 실패해도 당김 표시는 거둔다 — 실패 표시는 각 칸이 한다
    await Future.wait([
      _notices.then((_) {}, onError: (_) {}),
      _sermon,
      if (_bulletinFor != null) _loadBulletin(),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final actions = widget.actions;
    return Scaffold(
      appBar: AppBar(
        leading: const MenuButton(),
        actions: const [ProfileButton()],
        titleSpacing: 0,
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            // 앱 인트로와 같은 엠블럼 — 글자 'LIGHT'가 이름을 읽어 주니 그림은 건너뛴다
            Image.asset(
              'assets/images/logo.png',
              height: 36,
              excludeFromSemantics: true,
            ),
            const SizedBox(width: 8),
            Text(
              'LIGHT',
              style: TextStyle(
                color: Theme.of(context).colorScheme.primary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(bottom: 32),
          children: [
            _Hero(
              bulletin: _bulletin,
              onOpenBulletin: actions.onOpenBulletin,
              onFirstVisit: actions.onFirstVisit,
              onDirections: actions.onDirections,
            ),
            const SizedBox(height: 16),
            _SectionHeader(
              '이번 주 소식',
              link: '공지 전체보기',
              onLink: actions.onSeeAllNotices,
            ),
            _Notices(future: _notices, onOpen: actions.onOpenNotice),
            _LatestSermon(
              future: _sermon,
              onOpen: actions.onOpenSermon,
              onSeeAll: actions.onSeeAllSermons,
            ),
          ],
        ),
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({
    required this.bulletin,
    required this.onOpenBulletin,
    required this.onFirstVisit,
    required this.onDirections,
  });

  final Bulletin? bulletin;
  final void Function(String id) onOpenBulletin;
  final VoidCallback onFirstVisit;
  final VoidCallback onDirections;

  @override
  Widget build(BuildContext context) {
    final bulletin = this.bulletin;
    final hasBulletin = bulletin != null && bulletin.pages.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // 주보는 장 비율을 따른다 (bulletinAspectRatio). 없으면 칸 자체가 없다 —
        // 예배 사진은 아래 카드 배경이라 위에 또 두면 같은 사진이 두 번 보인다
        AnimatedSize(
          duration: const Duration(milliseconds: 300),
          alignment: Alignment.topCenter,
          child: hasBulletin
              ? AspectRatio(
                  key: ValueKey(bulletin.id),
                  aspectRatio: bulletinAspectRatio(bulletin),
                  child: BulletinCarousel(
                    bulletin: bulletin,
                    onOpen: () => onOpenBulletin(bulletin.id),
                  ),
                )
              : const SizedBox(width: double.infinity),
        ),
        Padding(
          padding: EdgeInsets.fromLTRB(16, hasBulletin ? 16 : 8, 16, 0),
          child: _WelcomeCard(
            onFirstVisit: onFirstVisit,
            onDirections: onDirections,
          ),
        ),
      ],
    );
  }
}

/// 예배 사진 위에 한 줄 소개 · 예배 시간 · 장소 · 버튼 2개.
///
/// 사진은 꾸밈이라 스크린리더가 건너뛴다 — 무엇이 있는지는 글자가 다 말한다.
/// 높이는 글자에 맞춰 늘어난다 (사진은 뒤에 깔릴 뿐) — 큰 글씨에서도 잘리지 않는다
class _WelcomeCard extends StatelessWidget {
  const _WelcomeCard({required this.onFirstVisit, required this.onDirections});

  final VoidCallback onFirstVisit;
  final VoidCallback onDirections;

  /// 사진 위 어두운 막 — 앱 올리브그린을 어둡게 한 색. 흰 글자가 사진의 밝은
  /// 곳(조명 · 화면)에 걸려도 읽히게 아래로 갈수록 짙다
  static const _scrimTop = Color(0x8C232B1E);
  static const _scrimBottom = Color(0xE6232B1E);

  /// 시계 아이콘 — 막 위에서 보이는 연한 초록
  static const _accent = Color(0xFFC9DDB8);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    const buttonShape = StadiumBorder();
    final buttonText = theme.textTheme.titleMedium?.copyWith(
      fontWeight: FontWeight.w700,
    );
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: Stack(
        children: [
          Positioned.fill(
            child: Image.asset(
              'assets/images/worship-hero.webp',
              fit: BoxFit.cover,
              excludeFromSemantics: true,
            ),
          ),
          const Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [_scrimTop, _scrimBottom],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 28, 20, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Semantics(
                  header: true,
                  child: Text(
                    '빛으로 함께 걷는\n청년공동체 LIGHT',
                    style: theme.textTheme.headlineSmall?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      height: 1.3,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Padding(
                      padding: EdgeInsets.only(top: 2),
                      child: Icon(Icons.schedule, color: _accent, size: 22),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '주일 14:00 · 드림센터 4층',
                        style: theme.textTheme.titleMedium?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: onFirstVisit,
                        icon: const Icon(Icons.favorite),
                        label: const Text('처음 오시는 분'),
                        style: FilledButton.styleFrom(
                          backgroundColor: scheme.surface,
                          foregroundColor: scheme.onSurface,
                          minimumSize: const Size(0, 52),
                          shape: buttonShape,
                          textStyle: buttonText,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: onDirections,
                        icon: const Icon(Icons.near_me_outlined),
                        label: const Text('오시는 길'),
                        style: FilledButton.styleFrom(
                          backgroundColor: Colors.white.withValues(alpha: 0.2),
                          foregroundColor: Colors.white,
                          minimumSize: const Size(0, 52),
                          shape: buttonShape,
                          textStyle: buttonText,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// 칸 제목 — ▌제목 ··· 전체보기 ›
///
/// 큰 글씨에서 한 줄에 다 못 들어가면 링크가 다음 줄로 내려간다 (Wrap)
class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.title, {required this.link, required this.onLink});

  final String title;
  final String link;
  final VoidCallback onLink;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 4, 8),
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Semantics(
            header: true,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                // 글자 크기를 따라 커지는 막대 — 고정 높이면 큰 글씨에서 짧아 보인다
                Container(
                  width: 6,
                  height:
                      (theme.textTheme.titleLarge?.fontSize ?? 22) *
                      MediaQuery.textScalerOf(context).scale(1),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.primary,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
                const SizedBox(width: 10),
                Text(
                  title,
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          TextButton(onPressed: onLink, child: Text('$link ›')),
        ],
      ),
    );
  }
}

class _Notices extends StatelessWidget {
  const _Notices({required this.future, required this.onOpen});

  final Future<List<PostSummary>> future;
  final void Function(PostSummary notice) onOpen;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const _Loading(height: 120);
        }
        if (snapshot.hasError) {
          return const _Message('공지를 불러오지 못했어요. 화면을 아래로 당겨 다시 시도해 주세요.');
        }
        final notices = snapshot.requireData;
        if (notices.isEmpty) return const _Message('새 공지가 없어요.');

        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final (i, notice) in notices.indexed) ...[
                if (i > 0) const SizedBox(height: 12),
                PostCard(notice, onTap: () => onOpen(notice)),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _LatestSermon extends StatelessWidget {
  const _LatestSermon({
    required this.future,
    required this.onOpen,
    required this.onSeeAll,
  });

  final Future<Sermon?> future;
  final void Function(Sermon sermon) onOpen;
  final VoidCallback onSeeAll;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: future,
      builder: (context, snapshot) {
        final sermon = snapshot.data;
        // 불러오는 중·없음·실패 모두 칸을 그리지 않는다 (웹과 같다)
        if (sermon == null) return const SizedBox.shrink();

        final theme = Theme.of(context);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 16),
            _SectionHeader('최근 말씀', link: '말씀 전체보기', onLink: onSeeAll),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Card(
                margin: EdgeInsets.zero,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: () => onOpen(sermon),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      VideoThumbnail(
                        url: sermon.thumbnailUrl,
                        semanticLabel: '${sermon.title} 영상',
                      ),
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              sermon.title,
                              style: theme.textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              formatDotDate(sermon.publishedAt),
                              style: theme.textTheme.bodyMedium?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _Loading extends StatelessWidget {
  const _Loading({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: const Center(child: CircularProgressIndicator()),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Text(
        text,
        style: theme.textTheme.bodyLarge?.copyWith(
          color: theme.colorScheme.onSurfaceVariant,
        ),
      ),
    );
  }
}
