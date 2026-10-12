import 'package:flutter/material.dart';

/// YouTube 썸네일 (16:9).
///
/// 영상이 비공개로 바뀌면 썸네일 주소가 404다 (SPEC_API §9.2) — 깨진 그림
/// 대신 자리표시자로 넘어간다. 성공·실패와 상관없이 16:9를 지켜서 목록이
/// 들쭉날쭉해지지 않는다.
class VideoThumbnail extends StatelessWidget {
  const VideoThumbnail({
    super.key,
    required this.url,
    required this.semanticLabel,
  });

  final String url;
  final String semanticLabel;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return AspectRatio(
      aspectRatio: 16 / 9,
      // 받는 동안 빈 칸이 배경과 같은 색이면 칸이 없는 것처럼 보인다
      child: ColoredBox(
        color: scheme.outlineVariant,
        child: Image.network(
          url,
          fit: BoxFit.cover,
          semanticLabel: semanticLabel,
          errorBuilder: (_, _, _) => Center(
            child: Text('▶ 영상 보기', style: TextStyle(color: scheme.onSurface)),
          ),
        ),
      ),
    );
  }
}
