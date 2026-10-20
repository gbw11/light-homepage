import 'package:flutter/material.dart';

import '../core/push/push_messaging.dart';

/// 앱을 보는 중에 온 알림을 아래 스낵바로 — 위 알림창과 같은 모양.
///
/// ```
///  🔔  [공지] 가을 수련회 안내              보기
///      (내용이 있으면 둘째 줄 — 새가족 알림 등)
/// ```
///
/// 첫 줄(제목)은 굵게, 둘째 줄(내용)은 작고 옅게 — 「새 공지 · 가을 수련회 안내」처럼
/// 한 줄로 이으면 어디까지가 종류이고 어디부터가 글 제목인지 구분이 안 됐다
/// (2026-10-20). 문구는 서버가 정하고, 공지 · 주보는 내용 없이 제목 한 줄만 온다
/// (SPEC_API §15.3). 보일 글이 없으면 null
SnackBar? pushSnackBar(PushPayload payload, {VoidCallback? onOpen}) {
  final title = payload.title?.trim() ?? '';
  final body = payload.body?.trim() ?? '';
  if (title.isEmpty && body.isEmpty) return null;
  return SnackBar(
    content: _PushSnackContent(title: title, body: body),
    action: onOpen == null
        ? null
        : SnackBarAction(label: '보기', onPressed: onOpen),
  );
}

class _PushSnackContent extends StatelessWidget {
  const _PushSnackContent({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    // 스낵바는 어두운 판(inverseSurface)이라 글자도 그 위 색을 쓴다
    final onSnack = scheme.onInverseSurface;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Icon(
            Icons.notifications_active_outlined,
            size: 20,
            color: scheme.inversePrimary,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (title.isNotEmpty)
                Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleSmall?.copyWith(
                    color: onSnack,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              if (title.isNotEmpty && body.isNotEmpty)
                const SizedBox(height: 2),
              if (body.isNotEmpty)
                Text(
                  body,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: onSnack.withValues(alpha: 0.75),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
