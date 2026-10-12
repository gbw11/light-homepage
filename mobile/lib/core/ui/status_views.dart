import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../api/api_error.dart';

// 화면 상태의 공용 모양 — 로딩 · 빈 상태 · 오류(오프라인 포함) (기획안 §1).
// 화면마다 따로 그리면 문구와 간격이 조금씩 어긋난다.

/// 오류를 사람이 읽을 문구로 바꾼다.
///
/// 화면이 따로 분기하는 것(404 → "찾을 수 없는 글" 등)은 각 화면이 먼저 거른다.
/// 여기는 그 밖의 전부다 — 서버 메시지를 그대로 보여주지 않는 이유는, 500의
/// 메시지가 사용자에게 의미가 없기 때문이다.
String describeError(Object error) => switch (error) {
  // 비행기 모드 · 와이파이 끊김 · 서버가 꺼져 있음 — 앱에서는 구별할 수 없다
  DioException(type: DioExceptionType.connectionError) =>
    '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.',
  DioException(
    type: DioExceptionType.connectionTimeout ||
        DioExceptionType.receiveTimeout ||
        DioExceptionType.sendTimeout,
  ) =>
    '서버가 응답하지 않아요. 잠시 후 다시 시도해 주세요.',
  ApiError(code: ErrorCode.rateLimited) => '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.',
  _ => '불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
};

/// 이만큼 기다려도 응답이 없으면 서버가 잠들어 있던 것이다
const serverWakeDelay = Duration(seconds: 10);

/// 불러오는 중.
///
/// Render 무료 서버는 한동안 요청이 없으면 잠들고, 깨어나는 데 30~60초가 걸린다
/// (ARCHITECTURE §8). 그동안 빙글빙글만 돌면 앱이 멈춘 줄 안다 — 그래서
/// [serverWakeDelay]가 지나면 이유를 말해 준다.
class LoadingView extends StatefulWidget {
  const LoadingView({super.key, this.height});

  /// 정하지 않으면 주어진 자리를 채우고 가운데에 둔다
  final double? height;

  @override
  State<LoadingView> createState() => _LoadingViewState();
}

class _LoadingViewState extends State<LoadingView> {
  late final Timer _timer;
  var _slow = false;

  @override
  void initState() {
    super.initState();
    _timer = Timer(serverWakeDelay, () => setState(() => _slow = true));
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final body = Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(),
            if (_slow) ...[
              const SizedBox(height: 16),
              Text(
                '서버를 깨우는 중이에요.\n처음 열 때는 1분 가까이 걸릴 수 있어요.',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ],
        ),
      ),
    );
    final height = widget.height;
    // 깨우는 문구가 붙으면 정한 높이보다 커질 수 있다 — 자르지 않고 늘린다
    return height == null
        ? body
        : ConstrainedBox(
            constraints: BoxConstraints(minHeight: height),
            child: body,
          );
  }
}

/// 오류 + [다시 시도]
class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return MessageView(
      icon: Icons.cloud_off_outlined,
      message: describeError(error),
      action: OutlinedButton(onPressed: onRetry, child: const Text('다시 시도')),
    );
  }
}

/// 빈 상태 · 안내 문구. [action]이 있으면 문구 아래에 둔다
class MessageView extends StatelessWidget {
  const MessageView({
    super.key,
    required this.message,
    this.icon = Icons.inbox_outlined,
    this.action,
  });

  final String message;
  final IconData icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 40, color: theme.colorScheme.onSurfaceVariant),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyLarge?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            if (action case final action?) ...[
              const SizedBox(height: 16),
              action,
            ],
          ],
        ),
      ),
    );
  }
}
