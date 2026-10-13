import 'package:image_picker/image_picker.dart';

import 'bulletins_api.dart';

/// 기기 사진첩에서 주보 사진을 여러 장 고른다 — 고른 순서대로.
///
/// 장변 2048px로 줄여 받는다. 웹도 같은 크기로 줄인다(`BULLETIN_MAX_EDGE`) —
/// 주보는 글자가 작아 그보다 줄이면 못 읽고, 그보다 크면 한 장 8MB 상한에 걸린다.
/// 줄이면서 JPEG로 다시 저장된다(품질 88). 서버는 JPEG · PNG · WebP를 받는다.
Future<List<UploadImage>> pickBulletinImages() async {
  final files = await ImagePicker().pickMultiImage(
    maxWidth: 2048,
    maxHeight: 2048,
    imageQuality: 88,
  );
  return [
    for (final file in files)
      (
        bytes: await file.readAsBytes(),
        mimeType: _mimeOf(file),
        extension: _extensionOf(file),
      ),
  ];
}

String _extensionOf(XFile file) {
  final name = file.name.toLowerCase();
  if (name.endsWith('.png')) return 'png';
  if (name.endsWith('.webp')) return 'webp';
  return 'jpg';
}

String _mimeOf(XFile file) => switch (_extensionOf(file)) {
  'png' => 'image/png',
  'webp' => 'image/webp',
  _ => 'image/jpeg',
};
