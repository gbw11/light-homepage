import 'package:flutter/material.dart';

import '../../core/api/api_error.dart';
import '../../core/format/file_size.dart';
import '../../core/ui/form_card.dart';
import '../../core/ui/status_views.dart';
import '../../core/upload/pick_file.dart';
import 'meetings_api.dart';

/// 월례회 자료 올리기 — 임원 이상 (웹 `/admin/meetings/new`, WIREFRAME §21,
/// SPEC_API §7.4).
///
/// 제목 · 월례회 날짜 · 열람 기간 · PDF 하나. 열람 기간 기본값은 웹과 같다 —
/// **당일 20:00 ~ 이틀 뒤 23:59** (월례회가 저녁에 열리고 주말 동안 확인한다).
/// 날짜를 바꾸면 손대지 않은 열람 기간 · 제목도 따라 바뀐다.
///
/// 서버가 PDF를 장마다 이미지로 바꾸는 동기 처리라 몇 초 걸린다. PDF 원본은
/// 서버에 남지 않는다.
class MeetingUploadScreen extends StatefulWidget {
  const MeetingUploadScreen({
    super.key,
    required this.meetings,
    required this.pickPdf,
    required this.onDone,
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now;

  final MeetingsApi meetings;

  /// PDF 고르기 — 고르지 않고 닫으면 null
  final Future<UploadFile?> Function() pickPdf;

  /// 다 올렸을 때 — 목록으로 돌아가 새로 받는다
  final VoidCallback onDone;
  final DateTime Function() _now;

  @override
  State<MeetingUploadScreen> createState() => _MeetingUploadScreenState();
}

class _MeetingUploadScreenState extends State<MeetingUploadScreen> {
  final _form = GlobalKey<FormState>();
  final _title = TextEditingController();
  late DateTime _date;
  late DateTime _from;
  late DateTime _until;

  /// 사람이 직접 고쳤으면 날짜를 바꿔도 따라 바꾸지 않는다
  var _titleEdited = false;
  var _windowEdited = false;

  UploadFile? _pdf;
  var _submitting = false;
  String? _error;
  String? _pdfError;

  @override
  void initState() {
    super.initState();
    final now = widget._now();
    _setDate(DateTime(now.year, now.month, now.day));
  }

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  void _setDate(DateTime date) {
    _date = date;
    if (!_titleEdited) _title.text = '${date.year}년 ${date.month}월 월례회';
    if (!_windowEdited) {
      _from = DateTime(date.year, date.month, date.day, 20);
      _until = DateTime(date.year, date.month, date.day + 2, 23, 59);
    }
  }

  String get _ymd => '${_date.year}-${_two(_date.month)}-${_two(_date.day)}';

  Future<void> _pickDate() async {
    final now = widget._now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 1, 12, 31),
      helpText: '월례회 날짜',
    );
    if (picked != null) setState(() => _setDate(picked));
  }

  /// 열람 시작 · 마감 — 날짜를 고르고 이어서 시각을 고른다
  Future<DateTime?> _pickDateTime(DateTime initial, String help) async {
    final day = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(initial.year - 1),
      lastDate: DateTime(initial.year + 1, 12, 31),
      helpText: help,
    );
    if (day == null || !mounted) return null;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(initial),
      helpText: help,
    );
    if (time == null) return null;
    return DateTime(day.year, day.month, day.day, time.hour, time.minute);
  }

  Future<void> _pickPdf() async {
    final pdf = await widget.pickPdf();
    if (pdf == null || !mounted) return;
    setState(() {
      _pdf = pdf;
      _pdfError = pdf.bytes.length > maxUploadBytes
          ? 'PDF가 8MB를 넘어요. 크기를 줄여 다시 골라 주세요.'
          : null;
    });
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _error = null);
    final formOk = _form.currentState!.validate();
    final pdf = _pdf;
    if (pdf == null) {
      setState(() => _pdfError = 'PDF를 골라 주세요.');
    }
    if (!_until.isAfter(_from)) {
      setState(() => _error = '열람 마감은 시작보다 뒤여야 해요.');
    }
    if (!formOk || pdf == null || _pdfError != null || _error != null) return;

    setState(() => _submitting = true);
    try {
      await widget.meetings.create(
        title: _title.text.trim(),
        meetingDate: _ymd,
        viewableFrom: _from,
        viewableUntil: _until,
        pdf: pdf,
      );
      if (mounted) widget.onDone();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        switch (error) {
          // PDF 아님 · 암호화 · 손상 — 서버 문구를 그대로 (사람이 읽으라고 쓴 것)
          case ApiError(code: ErrorCode.validationError, field: 'file'):
            _pdfError = error.message;
          case ApiError(code: ErrorCode.validationError, :final message):
            _error = message;
          default:
            _error = describeError(error);
        }
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final pdf = _pdf;
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          '월례회 자료 올리기',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
        children: [
          FormCard(
            child: Form(
              key: _form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const FieldLabel('월례회 날짜'),
                  const SizedBox(height: 8),
                  _PickRow(
                    icon: Icons.event_outlined,
                    text: '${_dot(_date)} (${_weekday(_date)})',
                    onTap: _submitting ? null : _pickDate,
                  ),
                  const SizedBox(height: 16),
                  CardField(
                    label: '제목',
                    icon: Icons.title,
                    controller: _title,
                    hint: '2026년 8월 월례회',
                    textInputAction: TextInputAction.done,
                    // 직접 고치면 날짜를 바꿔도 제목을 덮어쓰지 않는다
                    onChanged: (_) => _titleEdited = true,
                    validator: (v) =>
                        (v ?? '').trim().isEmpty ? '제목을 입력해 주세요.' : null,
                  ),
                  const SizedBox(height: 16),
                  const FieldLabel('열람 기간'),
                  const SizedBox(height: 4),
                  Text(
                    '이 기간에만 회원이 볼 수 있어요. 임원은 언제든 볼 수 있어요.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 8),
                  _PickRow(
                    icon: Icons.lock_open_outlined,
                    label: '시작',
                    text: _dotTime(_from),
                    onTap: _submitting
                        ? null
                        : () async {
                            final picked = await _pickDateTime(_from, '열람 시작');
                            if (picked != null) {
                              setState(() {
                                _from = picked;
                                _windowEdited = true;
                              });
                            }
                          },
                  ),
                  const SizedBox(height: 8),
                  _PickRow(
                    icon: Icons.lock_outline,
                    label: '마감',
                    text: _dotTime(_until),
                    onTap: _submitting
                        ? null
                        : () async {
                            final picked = await _pickDateTime(_until, '열람 마감');
                            if (picked != null) {
                              setState(() {
                                _until = picked;
                                _windowEdited = true;
                              });
                            }
                          },
                  ),
                  const SizedBox(height: 16),
                  const FieldLabel('PDF 파일'),
                  const SizedBox(height: 4),
                  Text(
                    'Word에서 「PDF로 저장」한 파일 하나 · 8MB · 50쪽까지',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (pdf != null)
                    _PdfRow(
                      pdf,
                      onRemove: _submitting
                          ? null
                          : () => setState(() {
                              _pdf = null;
                              _pdfError = null;
                            }),
                    )
                  else
                    OutlinedButton.icon(
                      onPressed: _submitting ? null : _pickPdf,
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(52),
                        shape: const StadiumBorder(),
                      ),
                      icon: const Icon(Icons.picture_as_pdf_outlined),
                      label: const Text('PDF 고르기'),
                    ),
                  if (_pdfError case final error?) ...[
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
                    // 서버가 장마다 이미지로 바꾸는 동안 기다린다 — 몇 초 걸린다
                    busyLabel: '올리는 중... 장마다 바꾸고 있어요',
                    busy: _submitting,
                    onPressed: _submit,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

String _two(int n) => n.toString().padLeft(2, '0');

String _dot(DateTime d) => '${d.year}.${_two(d.month)}.${_two(d.day)}';

String _dotTime(DateTime d) =>
    '${_dot(d)} (${_weekday(d)}) ${_two(d.hour)}:${_two(d.minute)}';

String _weekday(DateTime d) =>
    const ['월', '화', '수', '목', '금', '토', '일'][d.weekday - 1];

/// 눌러서 고르는 칸 — 베이지로 채운 둥근 칸 · 왼쪽 아이콘 · 오른쪽 「바꾸기」
class _PickRow extends StatelessWidget {
  const _PickRow({
    required this.icon,
    required this.text,
    required this.onTap,
    this.label,
  });

  final IconData icon;
  final String text;
  final String? label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Material(
      color: scheme.surfaceContainer,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Icon(icon, color: scheme.onSurfaceVariant),
              const SizedBox(width: 12),
              if (label case final label?) ...[
                Text(
                  label,
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(width: 8),
              ],
              Expanded(child: Text(text, style: theme.textTheme.bodyLarge)),
              Text(
                '바꾸기',
                style: theme.textTheme.labelLarge?.copyWith(
                  color: scheme.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 고른 PDF — 이름 · 크기 · 빼기
class _PdfRow extends StatelessWidget {
  const _PdfRow(this.pdf, {required this.onRemove});

  final UploadFile pdf;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.surfaceContainer,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 4, 8),
        child: Row(
          children: [
            Icon(Icons.picture_as_pdf_outlined, color: scheme.primary),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    pdf.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodyLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    formatFileSize(pdf.bytes.length),
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              onPressed: onRemove,
              tooltip: 'PDF 빼기',
              icon: const Icon(Icons.close),
            ),
          ],
        ),
      ),
    );
  }
}
