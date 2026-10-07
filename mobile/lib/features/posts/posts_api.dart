import '../../core/api/api_client.dart';
import '../../core/api/page.dart';
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
}
