import 'package:flutter/material.dart';

import '../../core/auth/auth_state.dart';
import '../../core/format/date_format.dart';
import '../../core/ui/menu_button.dart';
import '../../core/ui/signed_image.dart';
import '../bulletins/bulletin.dart';
import '../bulletins/bulletins_api.dart';
import '../posts/post_summary.dart';
import '../posts/posts_api.dart';
import '../sermons/sermon.dart';
import '../sermons/sermons_api.dart';
import '../sermons/video_thumbnail.dart';

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
  final void Function(BulletinSummary bulletin) onOpenBulletin;
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
/// 맨 위 그림은 로그인한 회원에게 **최신 주보 표지**다. 임원이 매주 올리면 따라
/// 바뀐다. 주보는 회원 전용이라(SPEC_API §5, 비로그인 401) 비로그인 · 주보 없음 ·
/// 실패에는 예배 사진을 둔다.
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
  BulletinSummary? _bulletin;
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
      // 최신순 — 첫 줄의 thumbUrl이 1쪽 원본이다 (SPEC_API §5.2)
      final page = await widget.bulletins.list(size: 1);
      // 기다리는 사이 로그아웃했으면 버린다
      if (mounted && userId == _bulletinFor) {
        setState(() => _bulletin = page.items.firstOrNull);
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
            _SectionTitle('이번 주'),
            _Notices(future: _notices, onOpen: actions.onOpenNotice),
            _MoreLink('공지 전체보기', onPressed: actions.onSeeAllNotices),
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

  final BulletinSummary? bulletin;
  final void Function(BulletinSummary bulletin) onOpenBulletin;
  final VoidCallback onFirstVisit;
  final VoidCallback onDirections;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final bulletin = this.bulletin;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // 16:9를 지킨다 — 더 키우면 작은 폰에서 예배 시간 · 버튼이 첫 화면 밖으로 밀린다.
        // 사진은 원본이 16:9라 그대로 두고(크롭하면 특정 인물이 확대될 수 있다 — 웹 홈 주석),
        // 세로로 긴 주보는 위쪽(제목 · 날짜가 있는 곳)을 남긴다
        AspectRatio(
          aspectRatio: 16 / 9,
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 300),
            child: bulletin == null
                ? Image.asset(
                    'assets/images/worship-hero.webp',
                    key: const ValueKey('photo'),
                    fit: BoxFit.cover,
                    semanticLabel: '어두운 예배 공간에서 손을 들어 찬양하는 청년들의 실루엣',
                  )
                : _BulletinCover(
                    bulletin,
                    key: ValueKey(bulletin.id),
                    onTap: () => onOpenBulletin(bulletin),
                  ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '주일 14:00 · 청년예배',
                style: text.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '드림센터 4층',
                style: text.titleLarge?.copyWith(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: FilledButton(
                      onPressed: onFirstVisit,
                      child: const Text('처음 오시는 분'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: onDirections,
                      child: const Text('오시는 길'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// 최신 주보 표지. 누르면 주보 보기로 간다 — 거기서 새 주소를 받으니
/// 표지 주소가 만료돼도(10분) 누르면 열린다
class _BulletinCover extends StatelessWidget {
  const _BulletinCover(this.bulletin, {super.key, required this.onTap});

  final BulletinSummary bulletin;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final date = formatYmd(bulletin.serviceDate);
    return Stack(
      fit: StackFit.expand,
      children: [
        // 그림과 글자는 아래 버튼 이름 하나로 읽힌다
        ExcludeSemantics(
          child: Stack(
            fit: StackFit.expand,
            children: [
              SignedImage(
                url: bulletin.thumbUrl,
                alignment: Alignment.topCenter,
              ),
              Align(
                alignment: Alignment.bottomCenter,
                child: DecoratedBox(
                  // 표지 색이 무엇이든 흰 글자가 읽히게 아래를 어둡게 깐다
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Color(0x00000000), Color(0xB3000000)],
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 24, 16, 12),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            '주보 · $date',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.titleMedium
                                ?.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '보기 ›',
                          style: Theme.of(context).textTheme.bodyLarge
                              ?.copyWith(color: Colors.white),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        // 그림 위 어디를 눌러도 열리게, 물결은 맨 위에 그린다
        // container — 없으면 아래 예배 시간 · 장소 글자까지 이 버튼 이름에 합쳐진다
        Semantics(
          container: true,
          button: true,
          label: '$date 주보 보기',
          child: Material(
            type: MaterialType.transparency,
            child: InkWell(onTap: onTap),
          ),
        ),
      ],
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title);

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Semantics(
        header: true,
        child: Text(
          title,
          style: Theme.of(context).textTheme.titleLarge
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}

/// 「▸ 전체보기」 링크. 웹처럼 목록 아래에 둔다 — 제목 옆에 두면 큰 글씨에서 한 줄이 넘친다
class _MoreLink extends StatelessWidget {
  const _MoreLink(this.label, {required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Align(
        alignment: Alignment.centerLeft,
        child: TextButton(onPressed: onPressed, child: Text('▸ $label')),
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

        return Column(
          children: [
            for (final (i, notice) in notices.indexed) ...[
              if (i > 0) const Divider(height: 1, indent: 16, endIndent: 16),
              _NoticeRow(notice, onTap: () => onOpen(notice)),
            ],
          ],
        );
      },
    );
  }
}

class _NoticeRow extends StatelessWidget {
  const _NoticeRow(this.notice, {required this.onTap});

  final PostSummary notice;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final publishedAt = notice.publishedAt;
    return InkWell(
      onTap: onTap,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 48),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 날짜 칸은 글자 크기를 따라 넓어져야 한다 — 고정 폭이면 큰 글씨에서 잘린다
              Padding(
                padding: const EdgeInsets.only(right: 16),
                child: Text(
                  publishedAt == null ? '' : formatMonthDay(publishedAt),
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ),
              Expanded(
                child: Text(
                  notice.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodyLarge?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
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
            const SizedBox(height: 8),
            const _SectionTitle('최근 말씀'),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Card(
                margin: EdgeInsets.zero,
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
            _MoreLink('지난 말씀 전체보기', onPressed: onSeeAll),
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
