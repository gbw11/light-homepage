import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../core/api/api_error.dart';
import '../../core/auth/auth_state.dart';
import '../../core/auth/auth_user.dart';
import '../../core/format/date_format.dart';
import '../../core/platform/screen_security.dart';
import '../../core/ui/status_views.dart';
import '../../core/ui/zoomable_image.dart';
import '../account/login_gate.dart';
import 'meeting.dart';
import 'meetings_api.dart';

/// 월례회 자료 보기 (웹 `/meetings/[id]`, WIREFRAME §14b-2 · §14b-3, 기획안 M8).
///
/// · 하단 탭을 덮는 전체 화면. **이 화면에 있는 동안 캡처 · 녹화를 막는다**
///   (Android FLAG_SECURE, 결정 D3). 떠나면 푼다
/// · 페이지는 서버가 워터마크를 합성해 보내는 이미지다 — 쿠키가 있어야 해서
///   앱이 직접 받아 메모리에서만 그린다. 기기에 저장하지 않는다
/// · 남은 시간은 서버가 준 `remainingSeconds`에서 센다. 0이 되면 회원에게는
///   "열람 기간이 종료되었습니다"로 바뀐다 — 서버도 그때부터 페이지를 주지 않는다
/// · 열 수 있는지는 서버가 정한다. `canView: false`와 403 둘 다 같은 안내로 받는다
class MeetingViewerScreen extends StatefulWidget {
  const MeetingViewerScreen({
    super.key,
    required this.meetings,
    required this.id,
    required this.onLogin,
  });

  final MeetingsApi meetings;
  final String id;
  final VoidCallback onLogin;

  @override
  State<MeetingViewerScreen> createState() => _MeetingViewerScreenState();
}

class _MeetingViewerScreenState extends State<MeetingViewerScreen> {
  late Future<MeetingDetail> _detail = widget.meetings.get(widget.id);

  /// 뷰어를 보는 동안 마감이 지났다 (회원)
  var _expired = false;

  void _reload() {
    setState(() {
      _expired = false;
      _detail = widget.meetings.get(widget.id);
    });
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: _detail,
      builder: (context, snapshot) {
        final detail = snapshot.data;
        final Widget body;
        if (snapshot.connectionState != ConnectionState.done) {
          body = const LoadingView();
        } else if (snapshot.error case final error?) {
          body = switch (error) {
            ApiError(code: ErrorCode.unauthorized) => LoginGate(
              onLogin: widget.onLogin,
            ),
            // 서버가 403으로 막는 경우 — 상태를 모르니 "끝났다"로 안내한다
            ApiError(code: ErrorCode.forbidden) => const _Unavailable(),
            ApiError(code: ErrorCode.notFound) => const MessageView(
              icon: Icons.search_off,
              message: '찾을 수 없는 자료예요.',
            ),
            _ => ErrorView(error: error, onRetry: _reload),
          };
        } else if (detail == null || !detail.canView || _expired) {
          body = _Unavailable(detail: detail, expired: _expired);
        } else {
          return SecureScreen(
            child: _Viewer(
              detail,
              meetings: widget.meetings,
              onExpired: () => setState(() => _expired = true),
              onLogin: widget.onLogin,
            ),
          );
        }
        return Scaffold(
          appBar: AppBar(
            title: Text(
              detail?.title ?? '월례회 자료',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          body: body,
        );
      },
    );
  }
}

/// 열 수 없는 자료 (WIREFRAME §14b-3). "아직"과 "이제 끝났다"는 다른 사실이다 —
/// 서버의 `viewReason`은 둘 다 `PERIOD_CLOSED`로 오기도 해서 [status]로 가른다
class _Unavailable extends StatelessWidget {
  const _Unavailable({this.detail, this.expired = false});

  final MeetingDetail? detail;
  final bool expired;

  @override
  Widget build(BuildContext context) {
    final scheduled = !expired && detail?.status == MeetingStatus.scheduled;
    final until = detail?.viewableUntil;
    return MessageView(
      icon: scheduled ? Icons.schedule : Icons.lock_clock_outlined,
      message: [
        scheduled ? '아직 열람 기간이 아니에요.' : '열람 기간이 끝났어요.',
        if (!scheduled && until != null)
          '${formatMonthDayTime(until)}까지 열람할 수 있었어요.',
        if (scheduled) '열람이 시작되면 목록에서 [열람하기]로 바뀌어요.',
        '자료가 필요하시면 임원에게 문의해 주세요.',
      ].join('\n'),
    );
  }
}

class _Viewer extends StatefulWidget {
  const _Viewer(
    this.detail, {
    required this.meetings,
    required this.onExpired,
    required this.onLogin,
  });

  final MeetingDetail detail;
  final MeetingsApi meetings;
  final VoidCallback onExpired;
  final VoidCallback onLogin;

  @override
  State<_Viewer> createState() => _ViewerState();
}

class _ViewerState extends State<_Viewer> {
  final _pages = PageController();

  /// 받아 둔 페이지. 넘기면서 필요한 장만 받는다
  final _cache = <int, Future<Uint8List>>{};
  var _index = 0;
  var _zoomed = false;

  Future<Uint8List> _page(int pageNo) =>
      _cache[pageNo] ??= widget.meetings.page(widget.detail.id, pageNo);

  void _retry(int pageNo) => setState(() => _cache.remove(pageNo));

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final detail = widget.detail;
    final user = AuthScope.maybeOf(context)?.user;
    // 기간 밖을 임원 권한으로 여는 중 — 카운트다운 대신 그 사실을 보인다
    final leaderView = detail.status != MeetingStatus.open;

    return Scaffold(
      backgroundColor: scheme.onSurface,
      appBar: AppBar(
        backgroundColor: scheme.onSurface,
        foregroundColor: scheme.surface,
        title: Text(
          detail.title,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: PageView.builder(
              controller: _pages,
              physics: _zoomed
                  ? const NeverScrollableScrollPhysics()
                  : const PageScrollPhysics(),
              itemCount: detail.pageCount,
              onPageChanged: (i) => setState(() => _index = i),
              itemBuilder: (context, i) => _Page(
                future: _page(i + 1),
                pageNo: i + 1,
                active: i == _index,
                onZoomChanged: (z) => setState(() => _zoomed = z),
                onRetry: () => _retry(i + 1),
                onExpired: widget.onExpired,
                onLogin: widget.onLogin,
              ),
            ),
          ),
          _BottomBar(
            index: _index,
            total: detail.pageCount,
            leaderView: leaderView,
            remainingSeconds: detail.remainingSeconds,
            onExpired: widget.onExpired,
            viewer: user,
          ),
        ],
      ),
    );
  }
}

class _Page extends StatelessWidget {
  const _Page({
    required this.future,
    required this.pageNo,
    required this.active,
    required this.onZoomChanged,
    required this.onRetry,
    required this.onExpired,
    required this.onLogin,
  });

  final Future<Uint8List> future;
  final int pageNo;
  final bool active;
  final ValueChanged<bool> onZoomChanged;
  final VoidCallback onRetry;
  final VoidCallback onExpired;
  final VoidCallback onLogin;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return FutureBuilder(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return Center(
            child: CircularProgressIndicator(color: scheme.surface),
          );
        }
        if (snapshot.error case final error?) {
          // 보는 사이 마감이 지났다 — 서버가 페이지를 더 주지 않는다
          if (error case ApiError(code: ErrorCode.forbidden)) {
            WidgetsBinding.instance.addPostFrameCallback((_) => onExpired());
          }
          return ColoredBox(
            color: scheme.surface,
            child: switch (error) {
              ApiError(code: ErrorCode.unauthorized) => LoginGate(
                onLogin: onLogin,
              ),
              _ => ErrorView(error: error, onRetry: onRetry),
            },
          );
        }
        return ZoomableImage(
          image: MemoryImage(snapshot.requireData),
          semanticLabel: '월례회 자료 $pageNo쪽',
          active: active,
          onZoomChanged: onZoomChanged,
          onReload: onRetry,
        );
      },
    );
  }
}

/// 아래 띠 — 쪽 번호 · 남은 시간(또는 임원 열람) · 워터마크 안내
class _BottomBar extends StatelessWidget {
  const _BottomBar({
    required this.index,
    required this.total,
    required this.leaderView,
    required this.remainingSeconds,
    required this.onExpired,
    required this.viewer,
  });

  final int index;
  final int total;
  final bool leaderView;
  final int remainingSeconds;
  final VoidCallback onExpired;
  final AuthUser? viewer;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final light = TextStyle(color: scheme.surface);
    final name = viewer?.name;
    final tail = _phoneTail(viewer?.phone);
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Text(
                  '${index + 1} / $total',
                  style: light.copyWith(fontWeight: FontWeight.w700),
                ),
                const Spacer(),
                if (leaderView)
                  Text(
                    '임원 열람',
                    style: light.copyWith(fontWeight: FontWeight.w700),
                  )
                else
                  _Countdown(
                    seconds: remainingSeconds,
                    onExpired: onExpired,
                    style: light,
                  ),
              ],
            ),
            const SizedBox(height: 8),
            // 무엇이 박히는지 보여 주는 것이 억제력이다 — 워터마크는 서버가 픽셀에 태운다
            Text(
              name == null
                  ? '페이지마다 열람자 이름이 표시됩니다. 캡처는 막혀 있어요.'
                  : '페이지마다 "$name${tail == null ? '' : ' $tail'}"이(가) '
                        '표시됩니다. 캡처는 막혀 있어요.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: scheme.surface.withValues(alpha: 0.8),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 남은 시간. 서버가 준 값을 기준점으로 지난 시간을 뺀다.
///
/// 지난 시간은 "1초 타이머가 돈 횟수"와 "실제 시각의 차이" 중 **큰 쪽**이다 —
/// 타이머 횟수만 세면 앱이 뒤로 가 있던 동안 밀려 실제보다 늦게 가고(웹과 같은
/// 이유), 시각만 보면 테스트의 가짜 시계로 확인할 수 없다
class _Countdown extends StatefulWidget {
  const _Countdown({
    required this.seconds,
    required this.onExpired,
    required this.style,
  });

  final int seconds;
  final VoidCallback onExpired;
  final TextStyle style;

  @override
  State<_Countdown> createState() => _CountdownState();
}

class _CountdownState extends State<_Countdown> {
  final _startedAt = DateTime.now();
  var _ticks = 0;
  late final Timer _timer;
  var _fired = false;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      setState(() => _ticks++);
      if (_remaining <= 0 && !_fired) {
        _fired = true;
        widget.onExpired();
      }
    });
  }

  int get _remaining {
    final wall = DateTime.now().difference(_startedAt).inSeconds;
    return widget.seconds - (wall > _ticks ? wall : _ticks);
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Text(
      '⏳ ${formatRemaining(_remaining)}',
      style: widget.style.copyWith(fontWeight: FontWeight.w700),
    );
  }
}

/// `010-1234-5678` → `5678` — 워터마크에 박히는 연락처 뒷자리 (SPEC_API §7.3)
String? _phoneTail(String? phone) {
  final digits = phone?.replaceAll(RegExp(r'\D'), '') ?? '';
  return digits.length < 4 ? null : digits.substring(digits.length - 4);
}
