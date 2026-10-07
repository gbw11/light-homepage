import 'package:flutter/material.dart';

import '../../core/format/date_format.dart';
import '../posts/post_summary.dart';
import '../posts/posts_api.dart';
import '../sermons/sermon.dart';
import '../sermons/sermons_api.dart';

/// 홈에서 다른 곳으로 가는 길. 화면 이동은 홈이 정하지 않고 바깥(탭 틀)이 정한다
class HomeActions {
  const HomeActions({
    required this.onFirstVisit,
    required this.onDirections,
    required this.onOpenNotice,
    required this.onSeeAllNotices,
    required this.onOpenSermon,
    required this.onSeeAllSermons,
  });

  final VoidCallback onFirstVisit;
  final VoidCallback onDirections;
  final void Function(PostSummary notice) onOpenNotice;
  final VoidCallback onSeeAllNotices;
  final void Function(Sermon sermon) onOpenSermon;
  final VoidCallback onSeeAllSermons;
}

/// 홈 (웹 `/home`을 앱에 맞게 줄인 것).
///
/// 앱을 여는 사람은 대부분 이미 다니는 회원이라 **이번 주 소식과 말씀**만 둔다.
/// 웹 홈의 「우리는」·「주일에는 이렇게 모입니다」는 더보기 탭으로 가고, 맨 아래
/// 「처음 오시나요?」는 맨 위 버튼과 겹쳐서 뺐다.
///
/// 맨 위는 웹과 같은 원칙을 지킨다 — **스크롤 없이 예배 시간 + 장소 + 다음 행동이
/// 모두 보인다** (WIREFRAME §1).
class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.posts,
    required this.sermons,
    required this.actions,
  });

  final PostsApi posts;
  final SermonsApi sermons;
  final HomeActions actions;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

/// 웹 홈과 같은 개수
const _noticeCount = 3;

class _HomeScreenState extends State<HomeScreen> {
  late Future<List<PostSummary>> _notices;
  late Future<Sermon?> _sermon;

  @override
  void initState() {
    super.initState();
    _load();
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
    await Future.wait([_notices.then((_) {}, onError: (_) {}), _sermon]);
  }

  @override
  Widget build(BuildContext context) {
    final actions = widget.actions;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'LIGHT',
          style: TextStyle(
            color: Theme.of(context).colorScheme.primary,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(bottom: 32),
          children: [
            _Hero(
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
  const _Hero({required this.onFirstVisit, required this.onDirections});

  final VoidCallback onFirstVisit;
  final VoidCallback onDirections;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // 원본이 16:9라 그대로 둔다 — 크롭하면 특정 인물이 확대될 수 있다 (웹 홈 주석)
        AspectRatio(
          aspectRatio: 16 / 9,
          child: Image.asset(
            'assets/images/worship-hero.webp',
            fit: BoxFit.cover,
            semanticLabel: '어두운 예배 공간에서 손을 들어 찬양하는 청년들의 실루엣',
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
                      AspectRatio(
                        aspectRatio: 16 / 9,
                        child: Image.network(
                          sermon.thumbnailUrl,
                          fit: BoxFit.cover,
                          semanticLabel: '${sermon.title} 영상',
                          // 영상이 비공개로 바뀌면 썸네일이 404다 (SPEC_API §9.2)
                          errorBuilder: (_, _, _) => const _ThumbnailFallback(),
                        ),
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

class _ThumbnailFallback extends StatelessWidget {
  const _ThumbnailFallback();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return ColoredBox(
      color: scheme.outlineVariant,
      child: Center(
        child: Text('▶ 영상 보기', style: TextStyle(color: scheme.onSurface)),
      ),
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
