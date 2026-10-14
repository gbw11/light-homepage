/// 설교 영상 (SPEC_API §9.2). 서버가 YouTube를 프록시해서 준다
class Sermon {
  const Sermon({
    required this.id,
    required this.title,
    required this.publishedAt,
    required this.youtubeUrl,
    required this.thumbnailUrl,
  });

  factory Sermon.fromJson(Map<String, dynamic> json) => Sermon(
    id: json['id'] as String,
    title: json['title'] as String,
    publishedAt: DateTime.parse(json['publishedAt'] as String),
    youtubeUrl: json['youtubeUrl'] as String,
    thumbnailUrl: json['thumbnailUrl'] as String,
  );

  /// 설교 제목만 — 영상 제목은 「2026년 10월 11일 l 내가 받은 만큼 l [김해교회 …]」
  /// 꼴이라 가운데 칸이 설교 제목이다. 구분자는 l(소문자 엘) · | · I 를 다 받는다.
  /// 그 꼴이 아니면 영상 제목 그대로
  String get headline {
    final parts = title.split(RegExp(r'\s[lI|｜]\s'));
    if (parts.length < 2) return title;
    final middle = parts[1].trim();
    return middle.isEmpty ? title : middle;
  }

  /// YouTube 영상 id — 목록 키로만 쓴다
  final String id;
  final String title;

  /// UTC
  final DateTime publishedAt;
  final String youtubeUrl;

  /// YouTube CDN 주소. 영상이 비공개로 바뀌면 404가 온다 — 화면이 자리표시자로 넘긴다
  final String thumbnailUrl;
}
