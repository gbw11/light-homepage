/// `24KB` · `1.5MB` — 첨부파일 크기. 웹 `NoticeDetailView`의 `formatSize`와 같다
String formatFileSize(int bytes) {
  if (bytes < 1024) return '${bytes}B';
  final kb = bytes / 1024;
  if (kb < 1024) return '${kb.toStringAsFixed(0)}KB';
  return '${(kb / 1024).toStringAsFixed(1)}MB';
}
