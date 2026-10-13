import 'package:flutter/material.dart';

import '../../core/api/api_error.dart';
import '../../core/auth/auth_state.dart';
import '../../core/format/date_format.dart';
import '../../core/paging/paged_list.dart';
import '../../core/ui/paged_list_view.dart';
import '../account/login_gate.dart';
import 'meeting.dart';
import 'meetings_api.dart';

/// 월례회 자료 목록 (웹 `/meetings`, WIREFRAME §14b-1, 기획안 §2-3 ④ M8).
///
/// 버튼 하나로 지금 열 수 있는지를 알린다 (기획안 §2-3 ④ · §5):
///   · 열람 기간 안 → 초록 [열람하기]
///   · 회원 · 기간 밖 → 회색으로 눌리지 않는 [열람 전] / [열람 종료]
///   · 임원 이상 · 기간 밖 → 갈색 [임원 열람] — 임원은 기간과 상관없이 연다
///     (SPEC_API §7.1). 목록에 버튼이 없으면 임원이 끝난 자료를 열 길이 없다
///
/// 끝난 자료도 목록에 남긴다 — "있었다"는 것은 알리되 내용은 막는다.
///
/// 임원 이상에게는 오른쪽 아래에 [월례회 자료 올리기]가 있다.
class MeetingsScreen extends StatefulWidget {
  const MeetingsScreen({
    super.key,
    required this.meetings,
    required this.onOpen,
    required this.onLogin,
    required this.onUpload,
  });

  final MeetingsApi meetings;
  final void Function(MeetingSummary meeting) onOpen;
  final VoidCallback onLogin;

  /// 올리기 화면을 연다 — 다 올렸으면 true로 끝난다. 임원 이상에게만 보인다
  final Future<bool?> Function() onUpload;

  @override
  State<MeetingsScreen> createState() => _MeetingsScreenState();
}

class _MeetingsScreenState extends State<MeetingsScreen> {
  late final _list = PagedList<MeetingSummary>(
    () => NumberedPageSource((page) => widget.meetings.list(page: page)),
  )..loadMore();

  @override
  void dispose() {
    _list.dispose();
    super.dispose();
  }

  Future<void> _upload() async {
    final uploaded = await widget.onUpload();
    if (uploaded != true || !mounted) return;
    await _list.refresh();
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(const SnackBar(content: Text('월례회 자료를 올렸어요.')));
  }

  @override
  Widget build(BuildContext context) {
    final isLeader = AuthScope.maybeOf(context)?.user?.role.isLeader ?? false;
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          '월례회 자료',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      floatingActionButton: isLeader
          ? FloatingActionButton.extended(
              onPressed: _upload,
              // 테마가 만든 기본색(primaryContainer)은 형광빛이라 앱 초록으로
              backgroundColor: scheme.primary,
              foregroundColor: scheme.onPrimary,
              icon: const Icon(Icons.upload_outlined),
              label: const Text('월례회 자료 올리기'),
            )
          : null,
      body: ListenableBuilder(
        listenable: _list,
        builder: (context, _) {
          final error = _list.error;
          if (_list.items.isEmpty &&
              error is ApiError &&
              error.code == ErrorCode.unauthorized) {
            return LoginGate(onLogin: widget.onLogin);
          }
          return PagedListView<MeetingSummary>(
            list: _list,
            onRefresh: _list.refresh,
            emptyMessage: '아직 올라온 월례회 자료가 없어요.',
            itemBuilder: (context, meeting) => _MeetingCard(
              meeting,
              isLeader: isLeader,
              onOpen: () => widget.onOpen(meeting),
            ),
            end: const _Notice(),
          );
        },
      ),
    );
  }
}

class _MeetingCard extends StatelessWidget {
  const _MeetingCard(
    this.meeting, {
    required this.isLeader,
    required this.onOpen,
  });

  final MeetingSummary meeting;
  final bool isLeader;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final muted = theme.textTheme.bodyMedium?.copyWith(
      color: scheme.onSurfaceVariant,
    );
    final status = meeting.status;
    final open = status == MeetingStatus.open;

    final note = switch (status) {
      MeetingStatus.open =>
        '${formatMonthDayTime(meeting.viewableUntil)}까지 · '
            '${formatRemaining(meeting.viewableUntil.difference(DateTime.now()).inSeconds)}',
      MeetingStatus.scheduled =>
        '${formatMonthDayTime(meeting.viewableFrom)}부터 열람할 수 있어요.',
      _ =>
        '열람 기간이 끝났어요 (${formatMonthDayTime(meeting.viewableFrom)} ~ '
            '${formatMonthDayTime(meeting.viewableUntil)}).'
            // 임원 자신에게 "임원에게 문의하세요"라고 하지 않는다 (DECISIONS 08-24)
            '${isLeader ? '' : ' 자료가 필요하시면 임원에게 문의해 주세요.'}',
    };

    final Widget button = switch ((open, isLeader)) {
      (true, _) => FilledButton(onPressed: onOpen, child: const Text('열람하기')),
      (false, true) => FilledButton(
        onPressed: onOpen,
        // 갈색 — 기간 밖을 임원 권한으로 연다는 표시 (CAROB, 웹 navy-800)
        style: FilledButton.styleFrom(
          backgroundColor: scheme.outline,
          foregroundColor: scheme.onPrimary,
        ),
        child: const Text('임원 열람'),
      ),
      (false, false) => FilledButton(
        onPressed: null,
        child: Text(status == MeetingStatus.scheduled ? '열람 전' : '열람 종료'),
      ),
    };

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            meeting.title,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${formatYmd(meeting.meetingDate)} · ${meeting.pageCount}페이지',
            style: muted,
          ),
          const SizedBox(height: 8),
          Text(
            note,
            style: open
                ? theme.textTheme.bodyLarge?.copyWith(
                    color: scheme.primary,
                    fontWeight: FontWeight.w700,
                  )
                : muted,
          ),
          const SizedBox(height: 12),
          button,
        ],
      ),
    );
  }
}

/// 목록 끝 — 무엇을 막고 무엇을 못 막는지 사실대로 (ARCHITECTURE §7.7).
/// "막았다"고 믿게 만드는 것이 이 기능에서 가장 위험한 결과다
class _Notice extends StatelessWidget {
  const _Notice();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      child: Text(
        '월례회 자료는 열람 기간 안에서만 볼 수 있고, 페이지마다 열람자 이름이 '
        '표시됩니다. 앱에서는 화면 캡처가 막혀 있지만 다른 기기로 찍는 것까지는 '
        '막을 수 없으니 자료를 밖으로 옮기지 말아 주세요.',
        style: theme.textTheme.bodyMedium?.copyWith(
          color: theme.colorScheme.onSurfaceVariant,
        ),
      ),
    );
  }
}
