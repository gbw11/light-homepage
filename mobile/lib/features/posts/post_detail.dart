import 'post_summary.dart';

/// 게시물 상세 (SPEC_API §3.3)
class PostDetail {
  const PostDetail({
    required this.id,
    required this.category,
    required this.title,
    required this.body,
    required this.pinned,
    required this.authorName,
    required this.publishedAt,
    required this.attachments,
  });

  factory PostDetail.fromJson(Map<String, dynamic> json) => PostDetail(
    id: json['id'] as String,
    category: PostCategory.parse(json['category'] as String),
    title: json['title'] as String,
    // 리치텍스트 JSON은 렌더러가 하나씩 확인하며 좁힌다 (`post_body_view.dart`)
    body: switch (json['body']) {
      final Map<String, dynamic> body => body,
      _ => const {},
    },
    pinned: json['pinned'] as bool,
    authorName: json['authorName'] as String?,
    publishedAt: switch (json['publishedAt']) {
      final String iso => DateTime.parse(iso),
      _ => null,
    },
    attachments: [
      for (final a in json['attachments'] as List<dynamic>? ?? const [])
        Attachment.fromJson(a as Map<String, dynamic>),
    ],
  );

  final String id;
  final PostCategory category;
  final String title;

  /// Tiptap/ProseMirror JSON (`{type: doc, content: [...]}`)
  final Map<String, dynamic> body;
  final bool pinned;
  final String? authorName;

  /// UTC. 상세에도 임시저장은 오지 않지만 계약상 nullable이다
  final DateTime? publishedAt;
  final List<Attachment> attachments;
}

/// 첨부파일. 받을 때는 `GET /files/{id}` (SPEC_API §4.2)
class Attachment {
  const Attachment({
    required this.id,
    required this.filename,
    required this.sizeBytes,
  });

  factory Attachment.fromJson(Map<String, dynamic> json) => Attachment(
    id: json['id'] as String,
    filename: json['filename'] as String,
    sizeBytes: json['sizeBytes'] as int,
  );

  final String id;
  final String filename;
  final int sizeBytes;
}
