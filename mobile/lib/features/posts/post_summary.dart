/// 게시물 분류 (SPEC_API §3.1)
enum PostCategory {
  noticePublic('NOTICE_PUBLIC'),
  noticeMember('NOTICE_MEMBER'),
  minutes('MINUTES'),
  budget('BUDGET');

  const PostCategory(this.wire);

  final String wire;

  static PostCategory parse(String raw) =>
      values.firstWhere((c) => c.wire == raw);
}

/// 게시물 목록의 한 줄 (SPEC_API §3.2)
class PostSummary {
  const PostSummary({
    required this.id,
    required this.category,
    required this.title,
    required this.slug,
    required this.pinned,
    required this.authorName,
    required this.publishedAt,
    required this.attachmentCount,
  });

  factory PostSummary.fromJson(Map<String, dynamic> json) => PostSummary(
    id: json['id'] as String,
    category: PostCategory.parse(json['category'] as String),
    title: json['title'] as String,
    slug: json['slug'] as String?,
    pinned: json['pinned'] as bool,
    authorName: json['authorName'] as String?,
    publishedAt: switch (json['publishedAt']) {
      final String iso => DateTime.parse(iso),
      _ => null,
    },
    attachmentCount: json['attachmentCount'] as int,
  );

  final String id;
  final PostCategory category;
  final String title;
  final String? slug;
  final bool pinned;
  final String? authorName;

  /// UTC. 목록에는 임시저장(null)이 오지 않지만 계약상 nullable이다
  final DateTime? publishedAt;
  final int attachmentCount;
}
