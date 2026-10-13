import 'package:file_picker/file_picker.dart';

/// 올릴 파일 하나 — 이름 · 바이트 · 종류
typedef UploadFile = ({String name, List<int> bytes, String mimeType});

/// 서버가 받는 한 파일 상한 — `spring.servlet.multipart.max-file-size`
const maxUploadBytes = 8 * 1024 * 1024;

/// PDF 하나 고르기 — 월례회 자료 (SPEC_API §7.4). 고르지 않으면 null
Future<UploadFile?> pickPdf() async {
  final file = await FilePicker.pickFile(
    type: FileType.custom,
    allowedExtensions: const ['pdf'],
  );
  if (file == null) return null;
  return (
    name: file.name,
    bytes: await file.readAsBytes(),
    mimeType: 'application/pdf',
  );
}

/// 아무 파일이나 여러 개 — 게시물 첨부 (SPEC_API §4.1). 고르지 않으면 빈 목록
Future<List<UploadFile>> pickAttachments() async {
  final files = await FilePicker.pickFiles();
  return [
    for (final file in files)
      (
        name: file.name,
        bytes: await file.readAsBytes(),
        mimeType: _mimeOf(file.name),
      ),
  ];
}

/// 확장자로 종류를 짐작한다 — 서버가 다시 확인한다
String _mimeOf(String name) {
  final ext = name.split('.').last.toLowerCase();
  return switch (ext) {
    'pdf' => 'application/pdf',
    'jpg' || 'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    'webp' => 'image/webp',
    'hwp' => 'application/x-hwp',
    'doc' => 'application/msword',
    'docx' =>
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls' => 'application/vnd.ms-excel',
    'xlsx' =>
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt' => 'application/vnd.ms-powerpoint',
    'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt' => 'text/plain',
    'zip' => 'application/zip',
    _ => 'application/octet-stream',
  };
}
