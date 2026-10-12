import 'package:flutter/material.dart';

import '../../core/api/api_error.dart';
import '../../core/ui/status_views.dart';
import 'photos_api.dart';

/// 사유는 1000자까지 (SPEC_API §6.10, 서버 `@Size(max = 1000)`)
const _maxReason = 1000;

/// 사진 신고 · 삭제 요청 (WIREFRAME §13-4 `⋮`, SPEC_API §6.10).
///
/// 초상권 대응 창구다. 보내면 `true`로 닫힌다 — 완료 안내는 여는 쪽이 띄운다.
///
/// ⚠️ 완료 문구로 "임원이 확인한 뒤 처리 결과를 알려드립니다"라고 **약속하지 않는다**
/// (웹은 그렇게 쓴다). 지금 백엔드는 요청을 로그로만 남겨서 아무에게도 가지 않는다
/// (점검 🟠-13, 기획안 §2-3 ③ ⚠️) — 지키지 못할 약속이 된다.
class PhotoReportSheet extends StatefulWidget {
  const PhotoReportSheet({
    super.key,
    required this.photos,
    required this.photoId,
  });

  final PhotosApi photos;
  final String photoId;

  @override
  State<PhotoReportSheet> createState() => _PhotoReportSheetState();
}

class _PhotoReportSheetState extends State<PhotoReportSheet> {
  final _form = GlobalKey<FormState>();
  final _reason = TextEditingController();
  var _sending = false;
  String? _reasonError;
  String? _error;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    setState(() {
      _reasonError = null;
      _error = null;
    });
    if (!_form.currentState!.validate()) return;

    setState(() => _sending = true);
    try {
      await widget.photos.report(widget.photoId, _reason.text.trim());
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        switch (error) {
          case ApiError(code: ErrorCode.validationError, field: 'reason'):
            _reasonError = error.message;
          case ApiError(code: ErrorCode.validationError):
            _error = error.message;
          default:
            _error = describeError(error);
        }
      });
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      // 키보드가 올라오면 시트도 함께 올린다
      padding: EdgeInsets.fromLTRB(
        16,
        0,
        16,
        16 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Form(
        key: _form,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                '사진 신고 · 삭제 요청',
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '본인이 찍힌 사진을 내려달라는 요청도 여기로 보내 주세요.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _reason,
                autofocus: true,
                minLines: 3,
                maxLines: 6,
                maxLength: _maxReason,
                decoration: const InputDecoration(
                  labelText: '요청 내용',
                  hintText: '예) 본인 사진 삭제 요청합니다',
                  alignLabelWithHint: true,
                ),
                forceErrorText: _reasonError,
                validator: (v) =>
                    (v ?? '').trim().isEmpty ? '요청 내용을 입력해주세요.' : null,
              ),
              if (_error case final error?) ...[
                const SizedBox(height: 8),
                Text(
                  error,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.error,
                  ),
                ),
              ],
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _sending ? null : _send,
                child: Text(_sending ? '보내는 중...' : '보내기'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
