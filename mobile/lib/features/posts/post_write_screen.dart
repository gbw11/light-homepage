import 'package:flutter/material.dart';

import '../../core/api/api_error.dart';
import '../../core/format/file_size.dart';
import '../../core/ui/form_card.dart';
import '../../core/ui/status_views.dart';
import '../../core/upload/pick_file.dart';
import 'post_summary.dart';
import 'posts_api.dart';

/// 글 쓰기 — 임원 이상 (웹 `/admin/posts/new`, SPEC_API §3.4 · §4.1).
///
/// 공지 · 회의록 · 예산안이 같은 화면이다. 공지는 「전체 공개 · 회원만」을 고른다 —
/// 회원 공지(NOTICE_MEMBER)는 로그인한 사람만 본다.
///
/// 본문은 줄글이다. 빈 줄로 문단을 나누면 웹 편집기와 같은 모양으로 저장된다
/// ([plainTextToDoc]). 굵게 · 목록 같은 꾸밈은 웹에서 한다.
///
/// 올리기는 두 걸음이다 — 첨부를 하나씩 올려 id를 받고, 그 id들을 붙여 글을 만든다.
/// 글을 만들기 전에 실패하면 올린 첨부는 서버가 24시간 뒤 지운다.
class PostWriteScreen extends StatefulWidget {
  const PostWriteScreen({
    super.key,
    required this.posts,
    required this.categories,
    required this.pickAttachments,
    required this.onDone,
  });

  final PostsApi posts;

  /// 고를 수 있는 분류 — 첫 번째가 기본값. 하나면 고르는 칸이 없다
  final List<PostCategory> categories;

  /// 첨부 고르기 — 고르지 않으면 빈 목록
  final Future<List<UploadFile>> Function() pickAttachments;

  /// 다 올렸을 때 — 만든 글의 id
  final void Function(String id) onDone;

  @override
  State<PostWriteScreen> createState() => _PostWriteScreenState();
}

class _PostWriteScreenState extends State<PostWriteScreen> {
  final _form = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _body = TextEditingController();
  late var _category = widget.categories.first;
  var _pinned = false;
  final _files = <UploadFile>[];

  var _submitting = false;

  /// 보내는 중에 무엇을 하고 있는지 — 「첨부 1/2 올리는 중...」
  String? _progress;
  String? _error;
  String? _titleError;
  String? _filesError;

  bool get _dirty =>
      _title.text.trim().isNotEmpty ||
      _body.text.trim().isNotEmpty ||
      _files.isNotEmpty;

  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    super.dispose();
  }

  Future<void> _pick() async {
    final picked = await widget.pickAttachments();
    if (picked.isEmpty || !mounted) return;
    setState(() {
      _files.addAll(picked);
      _filesError = _files.any((f) => f.bytes.length > maxUploadBytes)
          ? '8MB가 넘는 파일이 있어요. 그 파일을 빼 주세요.'
          : null;
    });
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() {
      _error = null;
      _titleError = null;
    });
    if (!_form.currentState!.validate() || _filesError != null) return;

    setState(() => _submitting = true);
    try {
      final ids = <String>[];
      for (final (i, file) in _files.indexed) {
        setState(() => _progress = '첨부 ${i + 1}/${_files.length} 올리는 중...');
        ids.add(await widget.posts.uploadAttachment(file));
      }
      setState(() => _progress = '글 올리는 중...');
      final id = await widget.posts.create(
        category: _category,
        title: _title.text.trim(),
        body: plainTextToDoc(_body.text),
        pinned: _pinned,
        attachmentIds: ids,
      );
      if (mounted) widget.onDone(id);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        switch (error) {
          case ApiError(code: ErrorCode.validationError, field: 'title'):
            _titleError = error.message;
          case ApiError(code: ErrorCode.validationError, :final message):
            _error = message;
          default:
            _error = describeError(error);
        }
      });
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
          _progress = null;
        });
      }
    }
  }

  /// 쓰던 것이 있으면 나가기 전에 묻는다 — 긴 공지를 실수로 날리지 않게
  Future<void> _confirmLeave() async {
    final leave = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('쓰던 글이 있어요'),
        content: const Text('나가면 쓴 내용이 사라져요. 나갈까요?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('계속 쓰기'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('나가기'),
          ),
        ],
      ),
    );
    if (leave == true && mounted) Navigator.of(context).pop();
  }

  String get _screenTitle => switch (_category) {
    PostCategory.noticePublic || PostCategory.noticeMember => '공지 쓰기',
    PostCategory.minutes => '회의록 쓰기',
    PostCategory.budget => '예산안 쓰기',
  };

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return PopScope(
      canPop: !_dirty || _submitting,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _confirmLeave();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(
            _screenTitle,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
          children: [
            FormCard(
              child: Form(
                key: _form,
                // 쓰기 시작하면 나가기 전에 묻도록 다시 그린다
                onChanged: () => setState(() {}),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (widget.categories.length > 1) ...[
                      const FieldLabel('공개 범위'),
                      const SizedBox(height: 8),
                      _CategoryChoice(
                        categories: widget.categories,
                        value: _category,
                        onChanged: _submitting
                            ? null
                            : (c) => setState(() => _category = c),
                      ),
                      const SizedBox(height: 16),
                    ],
                    CardField(
                      label: '제목',
                      icon: Icons.title,
                      controller: _title,
                      hint: '제목을 입력해 주세요',
                      errorText: _titleError,
                      textInputAction: TextInputAction.next,
                      validator: (v) {
                        final t = (v ?? '').trim();
                        if (t.isEmpty) return '제목을 입력해 주세요.';
                        if (t.length > 200) return '제목은 200자까지 쓸 수 있어요.';
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    CardField(
                      label: '내용',
                      controller: _body,
                      hint: '내용을 입력해 주세요.\n빈 줄로 문단을 나눌 수 있어요.',
                      helper: '굵게 · 목록 같은 꾸밈은 웹에서 할 수 있어요',
                      minLines: 8,
                      maxLines: null,
                      keyboardType: TextInputType.multiline,
                      validator: (v) =>
                          (v ?? '').trim().isEmpty ? '내용을 입력해 주세요.' : null,
                    ),
                    const SizedBox(height: 12),
                    // 상단 고정 — 목록에서 최신순보다 위에 둔다
                    Material(
                      color: scheme.surfaceContainer,
                      borderRadius: BorderRadius.circular(14),
                      child: SwitchListTile(
                        value: _pinned,
                        onChanged: _submitting
                            ? null
                            : (v) => setState(() => _pinned = v),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        title: Text(
                          '📌 맨 위에 고정',
                          style: theme.textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        subtitle: const Text('목록에서 최신 글보다 위에 보여요'),
                      ),
                    ),
                    const SizedBox(height: 16),
                    const FieldLabel('첨부파일', isRequired: false),
                    const SizedBox(height: 4),
                    Text(
                      '한 파일에 8MB까지',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 8),
                    for (final (i, file) in _files.indexed) ...[
                      _FileRow(
                        file,
                        onRemove: _submitting
                            ? null
                            : () => setState(() {
                                _files.removeAt(i);
                                if (!_files.any(
                                  (f) => f.bytes.length > maxUploadBytes,
                                )) {
                                  _filesError = null;
                                }
                              }),
                      ),
                      const SizedBox(height: 8),
                    ],
                    OutlinedButton.icon(
                      onPressed: _submitting ? null : _pick,
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(48),
                        shape: const StadiumBorder(),
                      ),
                      icon: const Icon(Icons.attach_file),
                      label: Text(_files.isEmpty ? '파일 첨부' : '파일 더 첨부'),
                    ),
                    if (_filesError case final error?) ...[
                      const SizedBox(height: 8),
                      FormErrorText(error),
                    ],
                    if (_error case final error?) ...[
                      const SizedBox(height: 16),
                      FormErrorText(error),
                    ],
                    const SizedBox(height: 20),
                    PillSubmitButton(
                      label: '올리기',
                      busyLabel: _progress ?? '올리는 중...',
                      busy: _submitting,
                      onPressed: _submit,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 공지의 공개 범위 — 알약 두 개
class _CategoryChoice extends StatelessWidget {
  const _CategoryChoice({
    required this.categories,
    required this.value,
    required this.onChanged,
  });

  final List<PostCategory> categories;
  final PostCategory value;
  final ValueChanged<PostCategory>? onChanged;

  static String _label(PostCategory c) => switch (c) {
    PostCategory.noticePublic => '전체 공개',
    PostCategory.noticeMember => '회원만',
    PostCategory.minutes => '회의록',
    PostCategory.budget => '예산안',
  };

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Row(
      spacing: 8,
      children: [
        for (final c in categories)
          Expanded(
            child: Semantics(
              button: true,
              selected: c == value,
              inMutuallyExclusiveGroup: true,
              child: Material(
                color: c == value ? scheme.primary : scheme.surfaceContainer,
                shape: const StadiumBorder(),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: onChanged == null ? null : () => onChanged!(c),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: 48),
                    child: Center(
                      child: Text(
                        _label(c),
                        style: theme.textTheme.titleSmall?.copyWith(
                          color: c == value
                              ? scheme.onPrimary
                              : scheme.onSurface,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// 고른 첨부 — 이름 · 크기 · 빼기
class _FileRow extends StatelessWidget {
  const _FileRow(this.file, {required this.onRemove});

  final UploadFile file;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final tooBig = file.bytes.length > maxUploadBytes;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.surfaceContainer,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 6, 4, 6),
        child: Row(
          children: [
            Icon(
              Icons.insert_drive_file_outlined,
              color: tooBig ? scheme.error : scheme.primary,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    file.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodyLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    formatFileSize(file.bytes.length),
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: tooBig ? scheme.error : scheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              onPressed: onRemove,
              tooltip: '${file.name} 빼기',
              icon: const Icon(Icons.close),
            ),
          ],
        ),
      ),
    );
  }
}
