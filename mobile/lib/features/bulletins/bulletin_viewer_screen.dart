import 'package:flutter/material.dart';

import '../../core/api/api_error.dart';
import '../../core/auth/auth_state.dart';
import '../../core/ui/status_views.dart';
import '../../core/ui/zoomable_image.dart';
import '../account/login_gate.dart';
import 'bulletin.dart';
import 'bulletins_api.dart';

/// 크기를 기록하지 않은 옛 주보의 가로:세로 — 장변 2048px 세로 (SPEC_API §5.1 예시)
const _fallbackAspectRatio = 1448 / 2048;

/// 주보 보기 (기획안 §2-3 ②, 사용자 시안 2026-10-13).
///
/// ```
///  주일 청년예배
///  2026년 10월 18일              [지난 주보 📅]   ← 달력에서 날짜를 고른다
///  ● 주보 순서지                         1 / 2 면
///  ┌ 흰 카드 ────────────────┐
///  │  (장 이미지 — 좌우로 넘기고 두 손가락으로 확대) │
///  └──────────────────────────┘
/// ```
///
/// 자료 탭의 「주보」는 [id] 없이 열어 **최신 주보**를 보여준다. 홈의 「이번 주 주보」는
/// 그 주보의 [id]로 연다. 임원 이상에게는 [주보 올리기]가 있다 — 다 올리면 최신
/// 주보를 다시 받는다.
///
/// 시안의 「예배순서 텍스트」 칸은 없다 — 주보는 이미지로만 올라와서 글로 된 예배
/// 순서가 서버에 없다.
class BulletinViewerScreen extends StatefulWidget {
  const BulletinViewerScreen({
    super.key,
    required this.bulletins,
    required this.onLogin,
    this.id,
    this.onUpload,
  });

  final BulletinsApi bulletins;
  final VoidCallback onLogin;

  /// 볼 주보. 없으면 최신 주보
  final String? id;

  /// 주보 올리기 화면을 연다 — 다 올렸으면 true로 끝난다. 임원 이상에게만 보인다
  final Future<bool?> Function()? onUpload;

  @override
  State<BulletinViewerScreen> createState() => _BulletinViewerScreenState();
}

class _BulletinViewerScreenState extends State<BulletinViewerScreen> {
  late String? _id = widget.id;
  late Future<Bulletin?> _bulletin = _load();

  /// [지난 주보] 달력에서 고를 수 있는 날짜들. 못 받아 오면 버튼만 빠진다
  late Future<List<BulletinSummary>> _all = _loadAll();

  var _pages = PageController();
  var _index = 0;
  var _zoomed = false;

  Future<Bulletin?> _load() => switch (_id) {
    final id? => widget.bulletins.get(id),
    null => widget.bulletins.latest(),
  };

  /// 주 1회씩 쌓이니 100부면 2년 치다 — 그보다 오래된 주보는 웹에서 본다
  Future<List<BulletinSummary>> _loadAll() => widget.bulletins
      .list(size: 100)
      .then((page) => page.items)
      .catchError((_) => <BulletinSummary>[]);

  /// 주소(10분)가 만료됐으면 새로 받는다. 보던 장은 그대로다
  void _reload() => setState(() {
    _bulletin = _load();
  });

  /// 다른 주보로 — 첫 장부터 본다. [id]가 null이면 최신 주보
  void _open(String? id) {
    setState(() {
      _id = id;
      _bulletin = _load();
      _pages.dispose();
      _pages = PageController();
      _index = 0;
      _zoomed = false;
    });
  }

  /// [지난 주보] — 달력에서 주보가 있는 날만 고를 수 있다
  Future<void> _pickPast(Bulletin current, List<BulletinSummary> all) async {
    final byDate = {for (final b in all) b.serviceDate: b.id};
    final dates = [for (final b in all) _parse(b.serviceDate)]..sort();
    final picked = await showDatePicker(
      context: context,
      initialDate: _parse(current.serviceDate),
      firstDate: dates.first,
      lastDate: dates.last,
      helpText: '주보가 있는 날만 고를 수 있어요',
      selectableDayPredicate: (day) => byDate.containsKey(_ymd(day)),
    );
    if (picked == null) return;
    final id = byDate[_ymd(picked)];
    if (id != null && id != current.id) _open(id);
  }

  Future<void> _upload() async {
    final uploaded = await widget.onUpload?.call();
    if (uploaded != true || !mounted) return;
    // 올린 주보가 보이게 최신 주보로 · 달력의 날짜도 새로
    _all = _loadAll();
    _open(null);
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(const SnackBar(content: Text('주보를 올렸어요.')));
  }

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isLeader = AuthScope.maybeOf(context)?.user?.role.isLeader ?? false;
    return Scaffold(
      appBar: AppBar(
        title: const Text('주보', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      floatingActionButton: isLeader && widget.onUpload != null
          ? FloatingActionButton.extended(
              onPressed: _upload,
              // 테마가 만든 기본색(primaryContainer)은 형광빛이라 앱 초록으로
              backgroundColor: scheme.primary,
              foregroundColor: scheme.onPrimary,
              icon: const Icon(Icons.upload_outlined),
              label: const Text('주보 올리기'),
            )
          : null,
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
          AsyncSnapshot(connectionState: ConnectionState.done, :final data) =>
            switch (data) {
              final bulletin? => _body(bulletin),
              null => const MessageView(message: '아직 올라온 주보가 없어요.'),
            },
          _ => const LoadingView(),
        },
      ),
    );
  }

  Widget _body(Bulletin bulletin) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return ListView(
      padding: const EdgeInsets.only(bottom: 96),
      children: [
        // 머리 — 옅은 베이지 띠
        ColoredBox(
          color: scheme.surfaceContainer,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
            child: Row(
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
                FutureBuilder(
                  future: _all,
                  builder: (context, snapshot) {
                    final all = snapshot.data ?? const <BulletinSummary>[];
                    // 고를 다른 주보가 없으면 버튼도 없다
                    if (all.length < 2) return const SizedBox.shrink();
                    return Padding(
                      padding: const EdgeInsets.only(left: 8),
                      child: FilledButton.tonalIcon(
                        onPressed: () => _pickPast(bulletin, all),
                        style: FilledButton.styleFrom(
                          backgroundColor: scheme.onPrimary,
                          foregroundColor: scheme.onSurface,
                          shape: const StadiumBorder(),
                        ),
                        iconAlignment: IconAlignment.end,
                        icon: const Icon(Icons.calendar_month_outlined),
                        label: const Text('지난 주보'),
                      ),
                    );
                  },
                ),
              ],
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

/// `2026-10-18` → 그날 자정 (기기 시간대). 날짜만 오는 값이라 시간대를 바꾸지 않는다
DateTime _parse(String ymd) {
  final [y, m, d] = ymd.split('-').map(int.parse).toList();
  return DateTime(y, m, d);
}

String _ymd(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-'
    '${d.day.toString().padLeft(2, '0')}';

/// `2026-10-18` → `2026년 10월 18일`
String _longDate(String ymd) {
  final d = _parse(ymd);
  return '${d.year}년 ${d.month}월 ${d.day}일';
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
    if (w == null || h == null || w <= 0 || h <= 0) return _fallbackAspectRatio;
    return w / h;
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final pages = bulletin.pages;
    return DecoratedBox(
      decoration: BoxDecoration(
        // 정한 색 토큰에 흰색이 따로 없어 onPrimary(흰색)를 쓴다
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
