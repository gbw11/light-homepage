/// 진행 중인 라이브 방송 (SPEC_API §9.3). 방송 중이 아니면 서버가 `null`을 준다
class LiveStream {
  const LiveStream({
    required this.videoId,
    required this.title,
    required this.startedAt,
    required this.watchUrl,
    required this.thumbnailUrl,
  });

  factory LiveStream.fromJson(Map<String, dynamic> json) => LiveStream(
    videoId: json['videoId'] as String,
    title: json['title'] as String,
    startedAt: DateTime.parse(json['startedAt'] as String),
    watchUrl: json['watchUrl'] as String,
    thumbnailUrl: json['thumbnailUrl'] as String,
  );

  final String videoId;
  final String title;

  /// UTC. 실제 방송 시작 시각
  final DateTime startedAt;
  final String watchUrl;
  final String thumbnailUrl;
}
