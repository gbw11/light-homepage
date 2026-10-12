import 'package:flutter/material.dart';

/// 서명된 주소(R2 presigned, 10분)의 이미지 — 주보 · 사진첩이 쓴다.
///
/// 주소에 권한이 실려 있어 쿠키 없이 열린다. 대신 **10분이 지나면 만료**된다
/// (SPEC_API §5 · §6, 로컬 실측 `X-Amz-Expires=600`). 화면을 오래 열어 두고
/// 내리면 아직 안 받은 이미지가 403으로 실패한다 — 그래서 실패한 자리를
/// 누르면 [onExpired]로 목록을 다시 받게 한다(새 주소가 온다).
class SignedImage extends StatelessWidget {
  const SignedImage({
    super.key,
    required this.url,
    this.fit = BoxFit.cover,
    this.semanticLabel,
    this.onExpired,
  });

  /// 없으면(대표 사진 없는 앨범 등) 빈 자리표시자
  final String? url;
  final BoxFit fit;
  final String? semanticLabel;
  final VoidCallback? onExpired;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final placeholder = ColoredBox(
      color: scheme.outlineVariant,
      child: const SizedBox.expand(),
    );
    final url = this.url;
    if (url == null) {
      return Semantics(label: semanticLabel, child: placeholder);
    }
    return Image.network(
      url,
      fit: fit,
      semanticLabel: semanticLabel,
      // 받는 동안 빈 칸이 배경과 같은 색이면 칸이 없는 것처럼 보인다
      loadingBuilder: (context, child, progress) =>
          progress == null ? child : placeholder,
      errorBuilder: (context, _, _) => Material(
        color: scheme.outlineVariant,
        child: InkWell(
          onTap: onExpired,
          child: Center(
            child: Icon(
              onExpired == null ? Icons.broken_image_outlined : Icons.refresh,
              color: scheme.onSurfaceVariant,
              semanticLabel: onExpired == null ? '이미지를 열 수 없음' : '다시 불러오기',
            ),
          ),
        ),
      ),
    );
  }
}
