import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

/// 게시물 리치텍스트 본문 렌더러 (SPEC_API §3.3 — Tiptap/ProseMirror JSON).
///
/// 웹 `components/post/PostBodyView.tsx`와 **같은 노드 집합**을 그린다.
/// 에디터(웹)가 만들 수 있는 것을 여기서 모르면, 작성자가 쓴 내용이 앱에서만
/// 조용히 사라진다. 지원 목록의 원본은 웹 `types/api.ts`의
/// `POST_BODY_NODES`(문단·제목·목록·인용·구분선·줄바꿈)와
/// `POST_BODY_MARKS`(굵게·기울임·밑줄·취소선·링크)다 — 웹에서 늘리면 여기도 늘린다.
///
/// 그래도 모르는 노드를 만나면 버리지 않고 안의 글자만이라도 문단으로 흘린다.
/// 웹 렌더러와 같은 안전망이다. 공지·회의록·예산안 상세가 함께 쓴다 (기획안 M5·M9).
class PostBodyView extends StatefulWidget {
  const PostBodyView({super.key, required this.body, required this.onOpenLink});

  /// `{type: doc, content: [...]}`. 신뢰하지 않고 하나씩 확인하며 읽는다
  final Map<String, dynamic> body;

  /// 본문 링크를 누르면. 허용한 주소만 넘어온다 ([safeLinkTarget])
  final void Function(String url) onOpenLink;

  @override
  State<PostBodyView> createState() => _PostBodyViewState();
}

class _PostBodyViewState extends State<PostBodyView> {
  /// 링크마다 하나. 그릴 때마다 새로 만들고, 옛것은 버린다
  final _recognizers = <TapGestureRecognizer>[];

  @override
  void dispose() {
    _disposeRecognizers();
    super.dispose();
  }

  void _disposeRecognizers() {
    for (final r in _recognizers) {
      r.dispose();
    }
    _recognizers.clear();
  }

  @override
  Widget build(BuildContext context) {
    _disposeRecognizers();
    final theme = Theme.of(context);
    return DefaultTextStyle.merge(
      style: theme.textTheme.bodyLarge?.copyWith(height: 1.6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: _blocks(context, _children(widget.body)),
      ),
    );
  }

  // ── 블록 ───────────────────────────────────────────────

  List<Widget> _blocks(BuildContext context, List<_Node> nodes) => [
    for (final (i, node) in nodes.indexed)
      Padding(
        // 블록 사이 간격. 첫 블록 위에는 두지 않는다
        padding: EdgeInsets.only(top: i == 0 ? 0 : _gapBefore(node)),
        child: _block(context, node),
      ),
  ];

  double _gapBefore(_Node node) => switch (node.type) {
    'heading' => 24,
    _ => 12,
  };

  Widget _block(BuildContext context, _Node node) {
    final theme = Theme.of(context);
    switch (node.type) {
      case 'paragraph':
        // 빈 문단은 작성자가 넣은 줄 간격이다 — 높이를 남긴다
        if (node.content.isEmpty) return const SizedBox(height: 8);
        return Text.rich(TextSpan(children: _inline(context, node.content)));

      case 'heading':
        // 화면 제목이 이미 가장 크다 — 본문 제목은 그보다 한 단계 아래부터
        final level = node.attrs['level'];
        final style = level is int && level >= 3
            ? theme.textTheme.titleMedium
            : theme.textTheme.titleLarge;
        return Semantics(
          header: true,
          child: Text.rich(
            TextSpan(children: _inline(context, node.content)),
            style: style?.copyWith(fontWeight: FontWeight.w700),
          ),
        );

      case 'bulletList':
        return _list(context, node, (_) => '•');

      case 'orderedList':
        final start = switch (node.attrs['start']) {
          final int n when n > 1 => n,
          _ => 1,
        };
        return _list(context, node, (i) => '${start + i}.');

      case 'blockquote':
        return DecoratedBox(
          decoration: BoxDecoration(
            border: Border(
              left: BorderSide(
                color: theme.colorScheme.outlineVariant,
                width: 4,
              ),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.only(left: 12),
            child: DefaultTextStyle.merge(
              style: TextStyle(color: theme.colorScheme.onSurfaceVariant),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: _blocks(context, node.content),
              ),
            ),
          ),
        );

      case 'horizontalRule':
        return const Divider(height: 16);

      case 'hardBreak':
        return const SizedBox(height: 8);

      default:
        // ★ 안전망: 모르는 블록도 글자는 살린다 (조용한 손실 방지).
        // 웹은 바로 아래 글자만 살리는데, 여기는 깊이 묻힌 글자까지 모은다
        final text = node.plainText;
        return text.isEmpty ? const SizedBox.shrink() : Text(text);
    }
  }

  /// 목록 — 항목마다 머리표(• 또는 번호)를 왼쪽에 세우고 내용을 오른쪽에
  Widget _list(BuildContext context, _Node list, String Function(int) marker) {
    final items = list.content;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (i, item) in items.indexed)
          Padding(
            padding: EdgeInsets.only(top: i == 0 ? 0 : 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 번호가 두 자리가 돼도 내용이 같은 줄에서 시작하게 최소 폭을 둔다
                ConstrainedBox(
                  constraints: const BoxConstraints(minWidth: 24),
                  child: Padding(
                    padding: const EdgeInsets.only(right: 4),
                    child: Text(marker(i)),
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    // 항목 안은 문단이다 — 웹처럼 항목 안 문단 사이는 붙인다
                    children: [
                      for (final child
                          in item.type == 'listItem' ? item.content : [item])
                        _block(context, child),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  // ── 인라인 (글자 + 서식) ────────────────────────────────

  List<InlineSpan> _inline(BuildContext context, List<_Node> nodes) {
    final scheme = Theme.of(context).colorScheme;
    return [
      for (final node in nodes)
        if (node.type == 'hardBreak')
          const TextSpan(text: '\n')
        else if (node.type != 'text' || node.text == null)
          // text·hardBreak 밖의 인라인 노드는 아직 없다 — 자식만 흘린다
          TextSpan(children: _inline(context, node.content))
        else
          _styledText(node, scheme),
    ];
  }

  TextSpan _styledText(_Node node, ColorScheme scheme) {
    var style = const TextStyle();
    final decorations = <TextDecoration>[];
    String? link;
    for (final mark in node.marks) {
      switch (mark.type) {
        case 'bold':
          style = style.copyWith(fontWeight: FontWeight.w700);
        case 'italic':
          style = style.copyWith(fontStyle: FontStyle.italic);
        case 'underline':
          decorations.add(TextDecoration.underline);
        case 'strike':
          decorations.add(TextDecoration.lineThrough);
        case 'link':
          link = safeLinkTarget(mark.attrs['href']);
        default:
        // 모르는 서식은 서식만 포기하고 글자는 남긴다
      }
    }
    if (link != null) {
      style = style.copyWith(color: scheme.primary);
      decorations.add(TextDecoration.underline);
    }
    if (decorations.isNotEmpty) {
      style = style.copyWith(decoration: TextDecoration.combine(decorations));
    }

    TapGestureRecognizer? recognizer;
    if (link case final url?) {
      recognizer = TapGestureRecognizer()..onTap = () => widget.onOpenLink(url);
      _recognizers.add(recognizer);
    }
    return TextSpan(text: node.text, style: style, recognizer: recognizer);
  }
}

/// 본문 링크 중 열어도 되는 주소만 돌려준다.
///
/// 본문은 임원이 쓰지만, `javascript:`·`data:`·`intent:` 같은 주소를 그대로
/// 열면 위험하다 (웹 `safeHref`와 같은 이유). 허용한 것만 통과시키고 나머지는
/// 링크 없이 글자만 남긴다.
///
/// 웹은 같은 사이트 상대 경로(`/news/…`)도 허용하지만 앱에는 웹 주소가 없어서
/// 열 곳이 없다 — 글자로만 둔다.
String? safeLinkTarget(Object? raw) {
  if (raw is! String) return null;
  final url = raw.trim();
  final scheme = Uri.tryParse(url)?.scheme.toLowerCase();
  return switch (scheme) {
    'http' || 'https' || 'mailto' || 'tel' => url,
    _ => null,
  };
}

// ── ProseMirror JSON 좁히기 ─────────────────────────────────
// 계약상 body.content는 아무 값이나 올 수 있다. 모양이 맞지 않는 것은 건너뛴다.

List<_Node> _children(Map<String, dynamic> json) => switch (json['content']) {
  final List<dynamic> list => [
    for (final item in list)
      if (item case final Map<String, dynamic> map when map['type'] is String)
        _Node(map),
  ],
  _ => const [],
};

class _Node {
  _Node(Map<String, dynamic> json)
    : type = json['type'] as String,
      text = json['text'] is String ? json['text'] as String : null,
      attrs = switch (json['attrs']) {
        final Map<String, dynamic> attrs => attrs,
        _ => const {},
      },
      marks = switch (json['marks']) {
        final List<dynamic> list => [
          for (final m in list)
            if (m case final Map<String, dynamic> map
                when map['type'] is String)
              _Node(map),
        ],
        _ => const [],
      },
      content = _children(json);

  final String type;
  final String? text;
  final Map<String, dynamic> attrs;
  final List<_Node> marks;
  final List<_Node> content;

  /// 안쪽 글자 전부 (안전망용)
  String get plainText =>
      text ??
      (type == 'hardBreak' ? '\n' : content.map((c) => c.plainText).join());
}
