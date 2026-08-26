/**
 * JPEG EXIF에서 **촬영 시각만** 읽는다 (`SPEC_API §6.5`의 `takenAt`).
 *
 * 라이브러리를 넣지 않는 이유: 우리가 필요한 태그는 두 개(`DateTimeOriginal`,
 * `OffsetTimeOriginal`)뿐이고, 회전은 `createImageBitmap`의
 * `imageOrientation: "from-image"`가 이미 처리한다 (`resize.ts`). EXIF 파서
 * 전체를 번들에 넣을 이유가 없다 (CONVENTIONS.md §1 — 새 의존성 먼저 의심).
 *
 * 실패는 전부 `null`이다. 촬영 시각은 **있으면 좋은 정보**이고, 없다고 업로드를
 * 막을 이유가 없다 (`Photo.takenAt`도 nullable이다).
 */

/** EXIF는 파일 앞부분에 있다. 전체를 읽으면 200장 × 수 MB가 메모리에 올라온다 */
const HEAD_BYTES = 128 * 1024;

/** `YYYY:MM:DD HH:MM:SS` (EXIF 고정 형식) */
const DATETIME_RE = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
/** `+09:00` · `-05:00` · `Z` 형태의 OffsetTimeOriginal (EXIF 2.31+) */
const OFFSET_RE = /^([+-]\d{2}:\d{2}|Z)$/;

const TAG_EXIF_IFD_POINTER = 0x8769;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_OFFSET_TIME_ORIGINAL = 0x9011;

/**
 * 촬영 시각을 ISO-8601로 돌려준다. EXIF가 없거나 JPEG가 아니면 `null`.
 *
 * ⚠️ `OffsetTimeOriginal`이 없는 사진(대부분의 구형 기기)은 **브라우저 로컬
 * 타임존으로 해석한다.** EXIF `DateTimeOriginal`에는 타임존이 없어서 다른
 * 방법이 없다 — 국내에서 찍어 국내에서 올리는 사용이 전제다.
 */
export async function readTakenAt(file: File): Promise<string | null> {
  try {
    const buffer = await file.slice(0, HEAD_BYTES).arrayBuffer();
    const view = new DataView(buffer);
    const app1 = findExifApp1(view);
    if (app1 === null) return null;
    return parseTiff(view, app1);
  } catch {
    return null;
  }
}

/** JPEG 마커를 걸어가며 `Exif\0\0`가 붙은 APP1 세그먼트의 TIFF 시작 위치를 찾는다 */
function findExifApp1(view: DataView): number | null {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null; // SOI

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return null; // 마커가 아니면 구조가 깨진 것
    const marker = view.getUint8(offset + 1);
    // SOS(0xda) 이후는 압축 데이터다 — EXIF는 그 앞에만 있다
    if (marker === 0xda) return null;
    const length = view.getUint16(offset + 2);
    if (marker === 0xe1 && offset + 10 <= view.byteLength) {
      // "Exif\0\0" (0x45786966 0x0000)
      if (view.getUint32(offset + 4) === 0x45786966 && view.getUint16(offset + 8) === 0) {
        return offset + 10;
      }
    }
    offset += 2 + length;
  }
  return null;
}

function parseTiff(view: DataView, tiff: number): string | null {
  if (tiff + 8 > view.byteLength) return null;

  const byteOrder = view.getUint16(tiff);
  if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) return null;
  const le = byteOrder === 0x4949; // "II" = little endian

  if (view.getUint16(tiff + 2, le) !== 0x2a) return null;
  const ifd0 = tiff + view.getUint32(tiff + 4, le);

  // 촬영 시각은 IFD0이 아니라 Exif IFD에 있다 — 포인터를 한 번 더 따라간다
  const exifIfdOffset = readTagAsLong(view, tiff, ifd0, le, TAG_EXIF_IFD_POINTER);
  if (exifIfdOffset === null) return null;
  const exifIfd = tiff + exifIfdOffset;

  const datetime = readTagAsAscii(view, tiff, exifIfd, le, TAG_DATETIME_ORIGINAL);
  const matched = datetime && DATETIME_RE.exec(datetime);
  if (!matched) return null;

  const [, y, mo, d, h, mi, s] = matched;
  const rawOffset = readTagAsAscii(view, tiff, exifIfd, le, TAG_OFFSET_TIME_ORIGINAL);
  const zone = rawOffset && OFFSET_RE.test(rawOffset) ? rawOffset : null;

  // 오프셋이 있으면 그대로 신뢰한다. 없으면 로컬 타임존 해석(위 ⚠️ 참고).
  const parsed = zone
    ? new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}${zone === "Z" ? "Z" : zone}`)
    : new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** IFD 엔트리 하나를 찾아 값 위치를 돌려준다 (12바이트 고정 크기) */
function findEntry(
  view: DataView,
  ifd: number,
  le: boolean,
  tag: number,
): { type: number; count: number; valueOffset: number } | null {
  if (ifd + 2 > view.byteLength) return null;
  const count = view.getUint16(ifd, le);

  for (let i = 0; i < count; i += 1) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > view.byteLength) return null;
    if (view.getUint16(entry, le) !== tag) continue;
    return {
      type: view.getUint16(entry + 2, le),
      count: view.getUint32(entry + 4, le),
      valueOffset: entry + 8,
    };
  }
  return null;
}

/** LONG(type 4) 태그 — Exif IFD 포인터가 이 형식이다 */
function readTagAsLong(
  view: DataView,
  tiff: number,
  ifd: number,
  le: boolean,
  tag: number,
): number | null {
  const entry = findEntry(view, ifd, le, tag);
  if (!entry || entry.type !== 4) return null;
  const value = view.getUint32(entry.valueOffset, le);
  // TIFF 헤더 기준 오프셋이므로 파일 범위를 벗어나면 버린다
  return tiff + value < view.byteLength ? value : null;
}

/** ASCII(type 2) 태그. 4바이트를 넘으면 값이 아니라 오프셋이 들어있다 */
function readTagAsAscii(
  view: DataView,
  tiff: number,
  ifd: number,
  le: boolean,
  tag: number,
): string | null {
  const entry = findEntry(view, ifd, le, tag);
  if (!entry || entry.type !== 2 || entry.count === 0) return null;

  const start =
    entry.count <= 4 ? entry.valueOffset : tiff + view.getUint32(entry.valueOffset, le);
  const end = start + entry.count;
  if (start < 0 || end > view.byteLength) return null;

  let text = "";
  for (let i = start; i < end; i += 1) {
    const code = view.getUint8(i);
    if (code === 0) break; // NUL 종료
    text += String.fromCharCode(code);
  }
  return text.trim() || null;
}
