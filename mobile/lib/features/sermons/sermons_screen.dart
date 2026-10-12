import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../content/links.dart';
import '../../content/worship.dart';
import '../../core/format/date_format.dart';
import '../../core/paging/paged_list.dart';
import '../../core/ui/menu_button.dart';
import '../../core/ui/paged_list_view.dart';
import 'live_stream.dart';
import 'sermon.dart';
import 'sermons_api.dart';
import 'video_thumbnail.dart';

/// 라이브 여부를 다시 물어보는 주기. 웹 `LiveSection.tsx`와 같다 — 서버 캐시도
/// 60초라 이보다 자주 물어도 소용없다 (SPEC_API §9.3)
const livePollInterval = Duration(seconds: 60);

/// 한 번에 받는 지난 말씀 수
const _pageSize = 12;

/// 말씀 탭 (웹 `/sermons` · `/sermons/all`, 기획안 §2-1).
///
/// 맨 위는 **라이브 카드** — 방송 중이면 [지금 보기], 아니면 다음 예배 시각.
/// 그 아래로 지난 말씀을 끝까지 내리며 본다.
///
/// 웹은 지난 말씀을 4편으로 줄이고 나머지는 YouTube 채널로 보냈다. 앱은 목록을
/// 이어서 보여준다 — 폰에서는 스크롤이 가장 싼 동작이고, 기획안이 무한 스크롤로
/// 정했다. 끝에는 웹처럼 채널로 가는 길을 둔다(찬양·브이로그는 채널에만 있다).
class SermonsScreen extends StatefulWidget {
  const SermonsScreen({
    super.key,
    required this.sermons,
    required this.openExternal,
  });

  final SermonsApi sermons;

  /// YouTube 앱(없으면 브라우저)으로 연다
  final void Function(String url) openExternal;

  @override
  State<SermonsScreen> createState() => _SermonsScreenState();
}

class _SermonsScreenState extends State<SermonsScreen> {
  late final _list = PagedList<Sermon>(
    () => NumberedPageSource(
      (page) => widget.sermons.list(page: page, size: _pageSize),
    ),
  );

  LiveStream? _live;
  Timer? _poll;

  /// 이 탭이 보이는 중인가. 다른 탭에 있을 때는 라이브를 묻지 않는다
  /// (탭 틀이 안 보이는 탭을 `TickerMode(enabled: false)`로 감싼다)
  ValueListenable<TickerModeData>? _visible;

  @override
  void initState() {
    super.initState();
    _list.loadMore();
    _checkLive();
    _poll = Timer.periodic(livePollInterval, (_) {
      // 앱이 뒤로 가 있으면 묻지 않는다. 아직 상태를 모르면(null) 앞에 있다고 본다
      final lifecycle = WidgetsBinding.instance.lifecycleState;
      final foreground =
          lifecycle == null || lifecycle == AppLifecycleState.resumed;
      if (foreground && (_visible?.value.enabled ?? true)) _checkLive();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _visible = TickerMode.getValuesNotifier(context);
  }

  @override
  void dispose() {
    _poll?.cancel();
    _list.dispose();
    super.dispose();
  }

  /// 라이브 조회는 실패해도 조용히 넘어간다 — 빨간 문구를 띄우면 "방송이 없다"와
  /// 구별되지 않는다 (웹과 같다). 그래서 실패하면 **직전 판단을 그대로** 둔다.
  /// 방송 중에 한 번 실패했다고 라이브 카드를 거두면 보던 사람이 길을 잃는다.
  Future<void> _checkLive() async {
    try {
      final live = await widget.sermons.live();
      if (mounted) setState(() => _live = live);
    } catch (_) {
      // 위 주석
    }
  }

  Future<void> _refresh() => Future.wait([_list.refresh(), _checkLive()]);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const MenuButton(),
        title: const Text('말씀', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: PagedListView<Sermon>(
        list: _list,
        onRefresh: _refresh,
        emptyMessage: '아직 등록된 영상이 없어요.',
        header: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: switch (_live) {
              final live? => _LiveCard(
                live,
                onWatch: () => widget.openExternal(live.watchUrl),
              ),
              null => const _NextServiceCard(),
            },
          ),
          const _SectionTitle('지난 말씀'),
        ],
        itemBuilder: (context, sermon) => _SermonRow(
          sermon,
          onTap: () => widget.openExternal(sermon.youtubeUrl),
        ),
        end: _ChannelLink(
          onPressed: () => widget.openExternal(youtubeChannelUrl),
        ),
      ),
    );
  }
}

/// 방송 중 — YouTube 앱의 라이브 표시처럼 빨간 LIVE 딱지를 단다.
///
/// 웹은 화면 안에 플레이어를 넣었지만 앱은 YouTube 앱으로 보낸다. 앱 안에서
/// 틀면 채팅·화면 꺼짐 재생·PIP를 다시 만들어야 하는데, YouTube 앱에 이미 있다.
class _LiveCard extends StatelessWidget {
  const _LiveCard(this.live, {required this.onWatch});

  final LiveStream live;
  final VoidCallback onWatch;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: scheme.error, width: 1.5),
      ),
      child: InkWell(
        onTap: onWatch,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Stack(
              children: [
                VideoThumbnail(
                  url: live.thumbnailUrl,
                  semanticLabel: '${live.title} 라이브 영상',
                ),
                const Positioned(left: 12, top: 12, child: _LiveBadge()),
              ],
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    '지금 라이브 중',
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: scheme.error,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    live.title,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: onWatch,
                    style: FilledButton.styleFrom(
                      backgroundColor: scheme.error,
                      foregroundColor: scheme.onError,
                    ),
                    icon: const Icon(Icons.play_arrow),
                    label: const Text('지금 보기'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LiveBadge extends StatelessWidget {
  const _LiveBadge();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.error,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        child: Text(
          'LIVE',
          style: TextStyle(
            color: scheme.onError,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.5,
          ),
        ),
      ),
    );
  }
}

/// 방송이 없을 때 — 언제 오면 라이브를 볼 수 있는지
class _NextServiceCard extends StatelessWidget {
  const _NextServiceCard();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(
              Icons.live_tv_outlined,
              size: 32,
              color: theme.colorScheme.primary,
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$sundayWorshipTime 청년예배',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '예배가 시작되면 여기에서 라이브를 볼 수 있어요.',
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
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title);

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 4),
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

/// 지난 말씀 한 줄 — 왼쪽 썸네일, 오른쪽 제목·날짜 (YouTube 앱 목록 모양).
/// 비율로 나눠서 글자를 키워도 썸네일이 글자를 밀어내지 않는다
class _SermonRow extends StatelessWidget {
  const _SermonRow(this.sermon, {required this.onTap});

  final Sermon sermon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              flex: 2,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: VideoThumbnail(
                  url: sermon.thumbnailUrl,
                  semanticLabel: '${sermon.title} 영상',
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 3,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    sermon.title,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodyLarge?.copyWith(
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
    );
  }
}

/// 목록 끝 — 설교 밖의 영상(찬양·브이로그)은 채널에만 있다
class _ChannelLink extends StatelessWidget {
  const _ChannelLink({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 32),
      child: Column(
        children: [
          OutlinedButton.icon(
            onPressed: onPressed,
            icon: const Icon(Icons.open_in_new),
            label: const Text('유튜브 채널에서 더 보기'),
          ),
          const SizedBox(height: 8),
          Text(
            '찬양·브이로그를 포함한 모든 영상은 채널에 있어요.',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}
