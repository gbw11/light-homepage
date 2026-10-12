/// 앨범 (SPEC_API §6.1)
class Album {
  const Album({
    required this.id,
    required this.title,
    required this.eventDate,
    required this.photoCount,
    required this.coverThumbUrl,
  });

  factory Album.fromJson(Map<String, dynamic> json) => Album(
    id: json['id'] as String,
    title: json['title'] as String,
    eventDate: json['eventDate'] as String?,
    photoCount: json['photoCount'] as int,
    coverThumbUrl: json['coverThumbUrl'] as String?,
  );

  final String id;
  final String title;

  /// `YYYY-MM-DD`
  final String? eventDate;
  final int photoCount;

  /// 대표 사진 썸네일 (서명된 주소, 10분). 사진이 없는 앨범은 null
  final String? coverThumbUrl;
}

/// 앨범 안의 사진 한 장 (SPEC_API §6.4)
class Photo {
  const Photo({
    required this.id,
    required this.thumbUrl,
    required this.viewUrl,
    this.width,
    this.height,
  });

  factory Photo.fromJson(Map<String, dynamic> json) => Photo(
    id: json['id'] as String,
    thumbUrl: json['thumbUrl'] as String,
    viewUrl: json['viewUrl'] as String,
    width: json['width'] as int?,
    height: json['height'] as int?,
  );

  final String id;

  /// 그리드용 640px (~80KB). 200장을 봐도 16MB 남짓이다
  final String thumbUrl;

  /// 크게 보기용 2560px
  final String viewUrl;
  final int? width;
  final int? height;
}
