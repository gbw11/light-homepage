/// 페이지 목록 응답 (SPEC_API §1.1 — `{ items, page, size, hasNext }`).
/// 사진 목록은 커서 방식이라 이 형태가 아니다.
class PageResult<T> {
  const PageResult({
    required this.items,
    required this.page,
    required this.size,
    required this.hasNext,
  });

  factory PageResult.fromJson(
    Object? data,
    T Function(Map<String, dynamic> json) item,
  ) {
    final json = data as Map<String, dynamic>;
    return PageResult(
      items: (json['items'] as List<dynamic>)
          .map((e) => item(e as Map<String, dynamic>))
          .toList(),
      page: json['page'] as int,
      size: json['size'] as int,
      hasNext: json['hasNext'] as bool,
    );
  }

  final List<T> items;
  final int page;
  final int size;
  final bool hasNext;
}
