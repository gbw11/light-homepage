import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../core/api/api_error.dart';
import '../../core/format/date_format.dart';
import '../../core/ui/form_card.dart';
import '../../core/ui/status_views.dart';
import 'bulletins_api.dart';

/// 한 장 상한 — 서버 `spring.servlet.multipart.max-file-size`
const _maxPageBytes = 8 * 1024 * 1024;

/// 장 수 상한 — 서버 `BulletinService.MAX_PAGES`
const maxBulletinPages = 20;

/// 주보 올리기 — 임원 이상 (웹 `/admin/bulletin/upload`, WIREFRAME §17, SPEC_API §5.4).
///
/// 예배 날짜 하나와 사진 여러 장. **고른 순서가 곧 장 순서**이고, 화살표로 바꾸거나
/// 뺄 수 있다. 사진은 고를 때 장변 2048px로 줄여 받는다 (웹도 같은 크기로 줄인다 —
/// 주보는 글자가 작아 그보다 줄이면 못 읽는다).
///
/// 같은 날짜의 주보가 이미 있으면 서버가 `DUPLICATE`를 준다. 교체 엔드포인트가
/// 없어서 **물어본 뒤 기존 주보를 지우고 다시 올린다** (웹과 같다). 지운 뒤 올리기가
/// 실패하면 기존 주보는 이미 없다 — 그렇게 알린다.
class BulletinUploadScreen extends StatefulWidget {
  const BulletinUploadScreen({
    super.key,
    required this.bulletins,
    required this.pickImages,
    required this.onDone,
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now;

  final BulletinsApi bulletins;

  /// 사진 고르기 — 기기 사진첩을 연다. 고르지 않고 닫으면 빈 목록
  final Future<List<UploadImage>> Function() pickImages;

  /// 다 올렸을 때 — 목록으로 돌아가 새로 받는다
  final VoidCallback onDone;
  final DateTime Function() _now;

  @override
  State<BulletinUploadScreen> createState() => _BulletinUploadScreenState();
}

class _BulletinUploadScreenState extends State<BulletinUploadScreen> {
  late DateTime _date = _upcomingSunday(widget._now());
  final _pages = <UploadImage>[];
  var _submitting = false;
  String? _error;

  /// 오늘이 주일이면 오늘, 아니면 다가오는 주일 — 주보는 보통 주일 전에 올린다
  static DateTime _upcomingSunday(DateTime now) {
    final today = DateTime(now.year, now.month, now.day);
    return today.add(Duration(days: (DateTime.sunday - today.weekday) % 7));
  }

  String get _ymd =>
      '${_date.year}-${_date.month.toString().padLeft(2, '0')}-'
      '${_date.day.toString().padLeft(2, '0')}';

  Future<void> _pickDate() async {
    final now = widget._now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 1, 12, 31),
      helpText: '예배 날짜',
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _pick() async {
    final picked = await widget.pickImages();
    if (!mounted || picked.isEmpty) return;
    setState(() {
      _error = null;
      final room = maxBulletinPages - _pages.length;
      _pages.addAll(picked.take(room));
      if (picked.length > room) {
        _error = '주보는 최대 $maxBulletinPages장까지 올릴 수 있어요.';
      }
    });
  }

  void _move(int from, int to) => setState(() {
    final page = _pages.removeAt(from);
    _pages.insert(to, page);
  });

  Future<void> _submit() async {
    if (_submitting) return;
    if (_pages.isEmpty) {
      setState(() => _error = '주보 사진을 한 장 이상 골라 주세요.');
      return;
    }
    if (_pages.any((p) => p.bytes.length > _maxPageBytes)) {
      setState(() => _error = '8MB가 넘는 사진이 있어요. 그 사진을 빼고 다시 골라 주세요.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await _create();
    } on ApiError catch (error) {
      if (error.code == ErrorCode.duplicate) {
        await _replace();
      } else if (mounted) {
        setState(() => _error = describeError(error));
      }
    } catch (error) {
      if (mounted) setState(() => _error = describeError(error));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _create() async {
    await widget.bulletins.create(serviceDate: _ymd, pages: _pages);
    if (mounted) widget.onDone();
  }

  /// DUPLICATE → 묻기 → 기존 주보 지우기 → 다시 올리기
  Future<void> _replace() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('같은 날짜의 주보가 있어요'),
        content: Text(
          '${formatYmd(_ymd)} 주보를 지금 고른 사진으로 바꿀까요?\n'
          '기존 주보는 지워지고 되돌릴 수 없어요.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('취소'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('교체'),
          ),
        ],
      ),
    );
    if (ok != true) {
      if (mounted) {
        setState(() => _error = '같은 날짜의 주보가 이미 있어요. 날짜를 바꾸거나 교체를 골라 주세요.');
      }
      return;
    }

    // 교체할 주보의 id는 목록에서 날짜로 찾는다 — DUPLICATE 응답은 id를 주지 않는다
    final existing = (await widget.bulletins.list(size: 50)).items
        .where((b) => b.serviceDate == _ymd)
        .firstOrNull;
    if (existing == null) {
      if (mounted) {
        setState(() => _error = '교체할 주보를 찾지 못했어요. 주보 목록을 확인한 뒤 다시 해 주세요.');
      }
      return;
    }
    await widget.bulletins.remove(existing.id);
    try {
      await _create();
    } catch (error) {
      if (mounted) {
        setState(
          () => _error =
              '교체에 실패했어요 — ${describeError(error)} '
              '기존 주보는 이미 지워졌으니 다시 올려 주세요.',
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          '주보 올리기',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
        children: [
          FormCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const FieldLabel('예배 날짜'),
                const SizedBox(height: 8),
                Material(
                  color: theme.colorScheme.surfaceContainer,
                  borderRadius: BorderRadius.circular(14),
                  child: InkWell(
                    onTap: _submitting ? null : _pickDate,
                    borderRadius: BorderRadius.circular(14),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 16,
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.event_outlined,
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              '${formatYmd(_ymd)} (${_weekday(_date)})',
                              style: theme.textTheme.bodyLarge,
                            ),
                          ),
                          Text(
                            '바꾸기',
                            style: theme.textTheme.labelLarge?.copyWith(
                              color: theme.colorScheme.primary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                const FieldLabel('주보 사진'),
                const SizedBox(height: 4),
                Text(
                  '고른 순서대로 1장, 2장… 이 돼요. 화살표로 순서를 바꿀 수 있어요. '
                  '(최대 $maxBulletinPages장)',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 12),
                for (final (i, page) in _pages.indexed) ...[
                  _PageRow(
                    index: i,
                    count: _pages.length,
                    bytes: Uint8List.fromList(page.bytes),
                    onUp: i > 0 && !_submitting ? () => _move(i, i - 1) : null,
                    onDown: i < _pages.length - 1 && !_submitting
                        ? () => _move(i, i + 1)
                        : null,
                    onRemove: _submitting
                        ? null
                        : () => setState(() => _pages.removeAt(i)),
                  ),
                  const SizedBox(height: 8),
                ],
                if (_pages.length < maxBulletinPages)
                  OutlinedButton.icon(
                    onPressed: _submitting ? null : _pick,
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(52),
                      shape: const StadiumBorder(),
                    ),
                    icon: const Icon(Icons.add_photo_alternate_outlined),
                    label: Text(_pages.isEmpty ? '사진 고르기' : '사진 더 고르기'),
                  ),
                if (_error case final error?) ...[
                  const SizedBox(height: 16),
                  FormErrorText(error),
                ],
                const SizedBox(height: 20),
                PillSubmitButton(
                  label: '올리기',
                  busyLabel: '올리는 중...',
                  busy: _submitting,
                  onPressed: _submit,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static String _weekday(DateTime d) =>
      const ['월', '화', '수', '목', '금', '토', '일'][d.weekday - 1];
}

/// 고른 사진 한 장 — 장 번호 · 미리보기 · ↑ ↓ · 빼기
class _PageRow extends StatelessWidget {
  const _PageRow({
    required this.index,
    required this.count,
    required this.bytes,
    required this.onUp,
    required this.onDown,
    required this.onRemove,
  });

  final int index;
  final int count;
  final Uint8List bytes;
  final VoidCallback? onUp;
  final VoidCallback? onDown;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final page = index + 1;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainer,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.memory(
                bytes,
                width: 64,
                height: 64,
                fit: BoxFit.cover,
                semanticLabel: '$page장 미리보기',
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                '$page장',
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            IconButton(
              onPressed: onUp,
              tooltip: '$page장을 앞으로',
              icon: const Icon(Icons.arrow_upward),
            ),
            IconButton(
              onPressed: onDown,
              tooltip: '$page장을 뒤로',
              icon: const Icon(Icons.arrow_downward),
            ),
            IconButton(
              onPressed: onRemove,
              tooltip: '$page장 빼기',
              icon: const Icon(Icons.close),
            ),
          ],
        ),
      ),
    );
  }
}
