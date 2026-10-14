import 'package:dio/dio.dart';

import '../../core/api/api_client.dart';
import '../../core/api/page.dart';
import '../../core/upload/pick_file.dart';
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

  /// 글 쓰기 — 임원(L) (SPEC_API §3.4). 만든 글의 id를 돌려준다.
  ///
  /// [body]는 리치텍스트(Tiptap) JSON이다 — [plainTextToDoc]으로 만든다.
  /// slug는 서버가 제목에서 만든다. [publish]가 false면 임시저장이라 목록에 안 나온다
  Future<String> create({
    required PostCategory category,
    required String title,
    required Map<String, dynamic> body,
    bool pinned = false,
    List<String> attachmentIds = const [],
    bool publish = true,
  }) => _client.post(
    '/posts',
    body: {
      'category': category.wire,
      'title': title,
      'body': body,
      'pinned': pinned,
      'attachmentIds': attachmentIds,
      'publish': publish,
    },
    decode: (data) => (data as Map<String, dynamic>)['id'] as String,
  );

  /// 첨부 올리기 — 임원(L) (SPEC_API §4.1). 글에 연결할 첨부 id를 돌려준다.
  /// 글에 연결되지 않은 첨부는 서버가 24시간 뒤 지운다
  Future<String> uploadAttachment(UploadFile file) => _client.postForm(
    '/attachments',
    form: () => FormData.fromMap({
      'file': MultipartFile.fromBytes(
        file.bytes,
        filename: file.name,
        contentType: DioMediaType.parse(file.mimeType),
      ),
    }),
    decode: (data) => (data as Map<String, dynamic>)['id'] as String,
  );
}

/// 앱에서 쓴 글(줄글)을 웹 편집기(Tiptap)와 같은 모양의 본문으로.
///
/// 빈 줄로 문단을 나누고, 문단 안의 줄바꿈은 hardBreak로 남긴다 — 웹에서 열어도
/// 앱에서 쓴 모양 그대로 보인다. 앞뒤 빈 줄은 버린다
Map<String, dynamic> plainTextToDoc(String text) {
  final paragraphs = text
      .replaceAll('\r\n', '\n')
      .trim()
      .split(RegExp(r'\n\s*\n'))
      .where((p) => p.trim().isNotEmpty);
  return {
    'type': 'doc',
    'content': [
      for (final p in paragraphs)
        {
          'type': 'paragraph',
          'content': [
            for (final (i, line) in p.split('\n').indexed) ...[
              if (i > 0) {'type': 'hardBreak'},
              if (line.isNotEmpty) {'type': 'text', 'text': line},
            ],
          ],
        },
    ],
  };
}
