/// 주보 목록의 한 줄 (SPEC_API §5.2)
class BulletinSummary {
  const BulletinSummary({
    required this.id,
    required this.serviceDate,
    required this.pageCount,
    required this.thumbUrl,
  });

  factory BulletinSummary.fromJson(Map<String, dynamic> json) =>
      BulletinSummary(
        id: json['id'] as String,
        serviceDate: json['serviceDate'] as String,
        pageCount: json['pageCount'] as int,
        thumbUrl: json['thumbUrl'] as String?,
      );

  final String id;

  /// `YYYY-MM-DD` — 예배 날짜. 시각이 아니라 시간대를 바꾸지 않는다
  final String serviceDate;
  final int pageCount;

  /// 서명된 주소 (10분). 만료되면 목록을 다시 받아야 새 주소가 온다
  final String? thumbUrl;
}

/// 주보 한 부 — 장(쪽)마다 큰 이미지 (SPEC_API §5.1 · §5.3)
class Bulletin {
  const Bulletin({
    required this.id,
    required this.serviceDate,
    required this.pages,
  });

  factory Bulletin.fromJson(Map<String, dynamic> json) => Bulletin(
    id: json['id'] as String,
    serviceDate: json['serviceDate'] as String,
    pages: [
      for (final p in json['pages'] as List<dynamic>)
        BulletinPage.fromJson(p as Map<String, dynamic>),
    ],
  );

  final String id;
  final String serviceDate;
  final List<BulletinPage> pages;
}

class BulletinPage {
  const BulletinPage({
    required this.pageNo,
    required this.url,
    this.width,
    this.height,
  });

  factory BulletinPage.fromJson(Map<String, dynamic> json) => BulletinPage(
    pageNo: json['pageNo'] as int,
    url: json['url'] as String,
    width: json['width'] as int?,
    height: json['height'] as int?,
  );

  final int pageNo;

  /// 장변 2048px 열람용 (서명된 주소, 10분). 글자가 작아 큰 이미지를 바로 준다
  final String url;

  /// 옛 주보는 크기를 기록하지 않아 null일 수 있다 (로컬 DB 실측 2026-10-12)
  final int? width;
  final int? height;
}
