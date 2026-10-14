import 'package:flutter/material.dart';

/// 목록 카드의 틀 — 흰 판 · 20px 둥근 모서리 · 옅은 그림자 · 누르면 물결.
///
/// 공지 · 회의록 · 예산안 · 사진첩 · 월례회 목록이 같은 모양이다
class ListCard extends StatelessWidget {
  const ListCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.fromLTRB(20, 18, 20, 16),
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      // 정한 색 토큰에 흰색이 따로 없어 onPrimary(흰색)를 쓴다
      color: scheme.onPrimary,
      borderRadius: BorderRadius.circular(20),
      elevation: 0.5,
      shadowColor: scheme.onSurface.withValues(alpha: 0.2),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(padding: padding, child: child),
      ),
    );
  }
}

/// 카드 위쪽 작은 알약 딱지. [strong]이면 초록 글자 · 옅은 초록 바탕,
/// 아니면 갈색 글자 · 베이지 바탕
class ListChip extends StatelessWidget {
  const ListChip(this.text, {super.key, this.strong = false, this.icon});

  final String text;
  final bool strong;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final fg = strong ? scheme.primary : scheme.onSurfaceVariant;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: strong
            ? scheme.primary.withValues(alpha: 0.14)
            : scheme.outlineVariant.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon case final icon?) ...[
              Icon(icon, size: 14, color: fg),
              const SizedBox(width: 4),
            ],
            Flexible(
              child: Text(
                text,
                style: theme.textTheme.labelMedium?.copyWith(
                  color: fg,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
