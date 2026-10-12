import 'package:flutter/material.dart';

import '../../core/api/api_error.dart';
import '../../core/format/date_format.dart';
import '../../core/paging/paged_list.dart';
import '../../core/ui/paged_list_view.dart';
import '../../core/ui/signed_image.dart';
import '../account/login_gate.dart';
import 'bulletin.dart';
import 'bulletins_api.dart';

/// 주보의 가로:세로 — 장변 2048px 세로 (SPEC_API §5.1 예시 1448×2048).
/// 크기를 기록하지 않은 옛 주보에도 이 비율로 자리를 잡는다
const bulletinAspectRatio = 1448 / 2048;

/// 주보 목록 (웹 `/bulletin`, WIREFRAME §6 · §12, 기획안 §2-3 ② M6).
///
/// 맨 위는 **이번 주 주보**를 크게, 그 아래로 지난 주보를 날짜순으로 둔다.
/// 누르면 장 단위로 넘겨 보는 뷰어가 열린다. 장별 내려받기는 1차에 넣지 않는다
/// (결정 D5).
class BulletinsScreen extends StatefulWidget {
  const BulletinsScreen({
    super.key,
    required this.bulletins,
    required this.onOpen,
    required this.onLogin,
  });

  final BulletinsApi bulletins;
  final void Function(BulletinSummary bulletin) onOpen;
  final VoidCallback onLogin;

  @override
  State<BulletinsScreen> createState() => _BulletinsScreenState();
}

class _BulletinsScreenState extends State<BulletinsScreen> {
  late final _list = PagedList<BulletinSummary>(
    () => NumberedPageSource(
      (page) => widget.bulletins.list(page: page, size: 20),
    ),
  )..loadMore();

  @override
  void dispose() {
    _list.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('주보', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: ListenableBuilder(
        listenable: _list,
        builder: (context, _) {
          // 보는 사이 세션이 끊겼다 — 목록 대신 로그인 안내
          final error = _list.error;
          if (_list.items.isEmpty &&
              error is ApiError &&
              error.code == ErrorCode.unauthorized) {
            return LoginGate(onLogin: widget.onLogin);
          }
          return PagedListView<BulletinSummary>(
            list: _list,
            onRefresh: _list.refresh,
            emptyMessage: '아직 올라온 주보가 없어요.',
            itemBuilder: (context, bulletin) =>
                identical(bulletin, _list.items.first)
                ? _Latest(
                    bulletin,
                    onTap: () => widget.onOpen(bulletin),
                    onExpired: _list.refresh,
                  )
                : _PastRow(
                    bulletin,
                    onTap: () => widget.onOpen(bulletin),
                    onExpired: _list.refresh,
                  ),
          );
        },
      ),
    );
  }
}

/// 이번 주 주보 — 첫 장을 크게
class _Latest extends StatelessWidget {
  const _Latest(this.bulletin, {required this.onTap, required this.onExpired});

  final BulletinSummary bulletin;
  final VoidCallback onTap;
  final VoidCallback onExpired;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(flex: 2, child: _Thumb(bulletin, onExpired: onExpired)),
            const SizedBox(width: 16),
            Expanded(
              flex: 3,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '이번 주 주보',
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: theme.colorScheme.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    formatYmd(bulletin.serviceDate),
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${bulletin.pageCount}장',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(onPressed: onTap, child: const Text('주보 보기')),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 지난 주보 한 줄
class _PastRow extends StatelessWidget {
  const _PastRow(this.bulletin, {required this.onTap, required this.onExpired});

  final BulletinSummary bulletin;
  final VoidCallback onTap;
  final VoidCallback onExpired;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            SizedBox(width: 56, child: _Thumb(bulletin, onExpired: onExpired)),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    formatYmd(bulletin.serviceDate),
                    style: theme.textTheme.bodyLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    '${bulletin.pageCount}장',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right,
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ],
        ),
      ),
    );
  }
}

class _Thumb extends StatelessWidget {
  const _Thumb(this.bulletin, {required this.onExpired});

  final BulletinSummary bulletin;
  final VoidCallback onExpired;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(6),
      child: AspectRatio(
        aspectRatio: bulletinAspectRatio,
        child: SignedImage(
          url: bulletin.thumbUrl,
          semanticLabel: '${formatYmd(bulletin.serviceDate)} 주보 첫 장',
          onExpired: onExpired,
        ),
      ),
    );
  }
}
