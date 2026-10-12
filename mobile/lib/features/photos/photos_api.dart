import '../../core/api/api_client.dart';
import '../../core/api/page.dart';
import 'album.dart';

/// 사진첩 API (SPEC_API §6). 열람은 회원(M). 업로드 · 앨범 만들기 · 삭제는
/// 앱에 만들지 않는다 — 웹에서 한다 (기획안 §1)
class PhotosApi {
  const PhotosApi(this._client);

  final ApiClient _client;

  Future<PageResult<Album>> albums({int? page, int? size}) => _client.get(
    '/albums',
    query: {'page': page, 'size': size},
    decode: (data) => PageResult.fromJson(data, Album.fromJson),
  );

  /// 커서 방식 — 첫 쪽은 cursor 없이
  Future<CursorPage<Photo>> photos(
    String albumId, {
    String? cursor,
    int? size,
  }) => _client.get(
    '/albums/$albumId/photos',
    query: {'cursor': cursor, 'size': size},
    decode: (data) => CursorPage.fromJson(data, Photo.fromJson),
  );

  /// 신고 · 삭제 요청. 사유는 1000자까지 (SPEC_API §6.10)
  Future<void> report(String photoId, String reason) => _client.postNoContent(
    '/photos/$photoId/report',
    body: {'reason': reason},
  );
}
