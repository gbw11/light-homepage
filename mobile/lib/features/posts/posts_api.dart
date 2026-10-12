import '../../core/api/api_client.dart';
import '../../core/api/page.dart';
import 'post_detail.dart';
import 'post_summary.dart';

/// 게시물 API (SPEC_API §3)
class PostsApi {
  const PostsApi(this._client);

  final ApiClient _client;

  /// 정렬은 서버가 한다 — 고정글 먼저, 그다음 최신순
  Future<PageResult<PostSummary>> list({
    required PostCategory category,
    int? page,
    int? size,
  }) => _client.get(
    '/posts',
    query: {'category': category.wire, 'page': page, 'size': size},
    decode: (data) => PageResult.fromJson(data, PostSummary.fromJson),
  );

  /// 없는 글과 권한 없는 글은 똑같이 `NOT_FOUND`다 — 서버가 존재를 숨긴다.
  /// 회원 글을 비로그인으로 열면 `UNAUTHORIZED` (SPEC_API §3.3)
  Future<PostDetail> get(String idOrSlug) => _client.get(
    '/posts/${Uri.encodeComponent(idOrSlug)}',
    decode: (data) => PostDetail.fromJson(data as Map<String, dynamic>),
  );

  /// 첨부를 받을 주소 (서명 URL, 10분). 권한은 원글을 따른다 (SPEC_API §4.2)
  Future<Uri> attachmentUrl(String attachmentId) =>
      _client.redirectLocation('/files/$attachmentId');
}
