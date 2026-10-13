import 'package:flutter/material.dart';

import '../../core/api/api_error.dart';
import '../../core/ui/status_views.dart';
import '../../core/ui/zoomable_image.dart';
import '../account/login_gate.dart';
import 'bulletin.dart';
import 'bulletins_api.dart';
import 'bulletins_screen.dart' show bulletinAspectRatio;

/// 주보 보기 (기획안 §2-3 ②, 사용자 시안 2026-10-13).
///
/// ```
///  주일 청년예배
///  2026년 10월 18일              [지난 주보 ▾]
///  (10월 18일 (이번 주)) (10월 4일) (8월 29일) …   ← 최근 주보, 눌러서 바꾼다
///  ● 주보 순서지                         1 / 2 면
///  ┌ 흰 카드 ────────────────┐
///  │  (장 이미지 — 좌우로 넘기고 두 손가락으로 확대) │
///  └──────────────────────────┘
/// ```
///
/// 홈의 「이번 주 주보」와 주보 목록에서 들어온다. 시안의 「예배순서 텍스트」 칸은
/// 없다 — 주보는 이미지로만 올라와서 글로 된 예배 순서가 서버에 없다.
class BulletinViewerScreen extends StatefulWidget {
  const BulletinViewerScreen({
    super.key,
    required this.bulletins,
    required this.id,
    required this.onLogin,
  });

  final BulletinsApi bulletins;
  final String id;
  final VoidCallback onLogin;

  @override
  State<BulletinViewerScreen> createState() => _BulletinViewerScreenState();
}

class _BulletinViewerScreenState extends State<BulletinViewerScreen> {
  late String _id = widget.id;
  late Future<Bulletin> _bulletin = widget.bulletins.get(_id);

  /// 위쪽 날짜 칩 · [지난 주보] 목록. 못 받아 오면 칩 줄만 빠진다
  late final Future<List<BulletinSummary>> _recent = widget.bulletins
      .list(size: 20)
      .then((page) => page.items)
      .catchError((_) => <BulletinSummary>[]);

  var _pages = PageController();
  var _index = 0;
  var _zoomed = false;

  /// 주소(10분)가 만료됐으면 새로 받는다. 보던 장은 그대로다
  void _reload() => setState(() {
    _bulletin = widget.bulletins.get(_id);
  });

  /// 다른 주보로 — 첫 장부터 본다
  void _open(String id) {
    if (id == _id) return;
    setState(() {
      _id = id;
      _bulletin = widget.bulletins.get(id);
      _pages.dispose();
      _pages = PageController();
      _index = 0;
      _zoomed = false;
    });
  }

  Future<void> _pickPast(List<BulletinSummary> recent) async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            for (final (i, b) in recent.indexed)
              ListTile(
                title: Text(_longDate(b.serviceDate)),
                subtitle: Text('${b.pageCount}장${i == 0 ? ' · 이번 주' : ''}'),
                trailing: b.id == _id
                    ? Icon(
                        Icons.check,
                        color: Theme.of(context).colorScheme.primary,
                      )
                    : null,
                onTap: () => Navigator.pop(context, b.id),
              ),
          ],
        ),
      ),
    );
    if (picked != null) _open(picked);
  }

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('주보', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: FutureBuilder(
        future: _bulletin,
        builder: (context, snapshot) => switch (snapshot) {
          AsyncSnapshot(:final error?) => switch (error) {
            ApiError(code: ErrorCode.unauthorized) => LoginGate(
              onLogin: widget.onLogin,
            ),
            ApiError(code: ErrorCode.notFound) => const MessageView(
              icon: Icons.search_off,
              message: '찾을 수 없는 주보예요.',
            ),
            _ => ErrorView(error: error, onRetry: _reload),
          },
          AsyncSnapshot(data: final bulletin?) => _body(bulletin),
          _ => const LoadingView(),
        },
      ),
    );
  }

  Widget _body(Bulletin bulletin) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return ListView(
      padding: const EdgeInsets.only(bottom: 32),
      children: [
        // 머리 — 옅은 베이지 띠
        ColoredBox(
          color: scheme.surfaceContainer,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
            child: FutureBuilder(
              future: _recent,
              builder: (context, snapshot) {
                final recent = snapshot.data ?? const <BulletinSummary>[];
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '주일 청년예배',
                                style: theme.textTheme.labelLarge?.copyWith(
                                  color: scheme.onSurfaceVariant,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Semantics(
                                header: true,
                                child: Text(
                                  _longDate(bulletin.serviceDate),
                                  style: theme.textTheme.titleLarge?.copyWith(
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (recent.length > 1) ...[
                          const SizedBox(width: 8),
                          FilledButton.tonalIcon(
                            onPressed: () => _pickPast(recent),
                            style: FilledButton.styleFrom(
                              backgroundColor: scheme.onPrimary,
                              foregroundColor: scheme.onSurface,
                              shape: const StadiumBorder(),
                            ),
                            iconAlignment: IconAlignment.end,
                            icon: const Icon(Icons.expand_more),
                            label: const Text('지난 주보'),
                          ),
                        ],
                      ],
                    ),
                    if (recent.length > 1) ...[
                      const SizedBox(height: 12),
                      _DateChips(
                        recent: recent,
                        selectedId: _id,
                        onSelected: _open,
                      ),
                    ],
                  ],
                );
              },
            ),
          ),
        ),
        const SizedBox(height: 20),
        if (bulletin.pages.isEmpty)
          const MessageView(message: '이 주보에는 올라온 장이 없어요.')
        else ...[
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: scheme.primary,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '주보 순서지',
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                // 「1 / 2 면」 — 몇 장 중 몇 번째인지
                Semantics(
                  liveRegion: true,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: scheme.surfaceContainer,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 4,
                      ),
                      child: Text(
                        '${_index + 1} / ${bulletin.pages.length} 면',
                        style: theme.textTheme.labelLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: _PageCard(
              bulletin,
              controller: _pages,
              index: _index,
              zoomed: _zoomed,
              onPageChanged: (i) => setState(() => _index = i),
              onZoomChanged: (z) => setState(() => _zoomed = z),
              onReload: _reload,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            '좌우로 넘기고, 두 손가락으로 벌려 확대할 수 있어요.',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall?.copyWith(
              color: scheme.onSurfaceVariant,
            ),
          ),
        ],
      ],
    );
  }
}

/// `2026-10-18` → `2026년 10월 18일` (시간대를 바꾸지 않는다 — 날짜만 오는 값)
String _longDate(String ymd) {
  final [y, m, d] = ymd.split('-').map(int.parse).toList();
  return '$y년 $m월 $d일';
}

/// `2026-10-18` → `10월 18일`
String _shortDate(String ymd) {
  final [_, m, d] = ymd.split('-').map(int.parse).toList();
  return '$m월 $d일';
}

/// 최근 주보 날짜 칩 — 맨 앞이 이번 주. 고른 것이 짙은 초록
class _DateChips extends StatelessWidget {
  const _DateChips({
    required this.recent,
    required this.selectedId,
    required this.onSelected,
  });

  final List<BulletinSummary> recent;
  final String selectedId;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        spacing: 8,
        children: [
          for (final (i, b) in recent.take(8).indexed)
            Semantics(
              button: true,
              selected: b.id == selectedId,
              child: Material(
                color: b.id == selectedId ? scheme.primary : scheme.onPrimary,
                shape: const StadiumBorder(),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: () => onSelected(b.id),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: 44),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Center(
                        widthFactor: 1,
                        child: Text(
                          '${_shortDate(b.serviceDate)}${i == 0 ? ' (이번 주)' : ''}',
                          style: theme.textTheme.labelLarge?.copyWith(
                            color: b.id == selectedId
                                ? scheme.onPrimary
                                : scheme.onSurface,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// 흰 카드 속 장 이미지 — 좌우로 넘기고, 두 손가락으로 확대한다
class _PageCard extends StatelessWidget {
  const _PageCard(
    this.bulletin, {
    required this.controller,
    required this.index,
    required this.zoomed,
    required this.onPageChanged,
    required this.onZoomChanged,
    required this.onReload,
  });

  final Bulletin bulletin;
  final PageController controller;
  final int index;
  final bool zoomed;
  final ValueChanged<int> onPageChanged;
  final ValueChanged<bool> onZoomChanged;
  final VoidCallback onReload;

  /// 장 크기를 알면 그 비율로 — 가로 펼침면 · 세로 한 면 모두 잘리지 않게
  double get _aspect {
    final first = bulletin.pages.first;
    final (w, h) = (first.width, first.height);
    if (w == null || h == null || w <= 0 || h <= 0) return bulletinAspectRatio;
    return w / h;
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final pages = bulletin.pages;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.onPrimary,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: scheme.onSurface.withValues(alpha: 0.06),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: AspectRatio(
            aspectRatio: _aspect,
            child: PageView.builder(
              controller: controller,
              // 확대한 채로 끌면 넘기지 않고 장 안을 움직인다
              physics: zoomed
                  ? const NeverScrollableScrollPhysics()
                  : const PageScrollPhysics(),
              itemCount: pages.length,
              onPageChanged: onPageChanged,
              itemBuilder: (context, i) => ZoomableImage(
                image: NetworkImage(pages[i].url),
                semanticLabel: '주보 ${pages[i].pageNo}쪽',
                active: i == index,
                onZoomChanged: onZoomChanged,
                onReload: onReload,
                onLight: true,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
