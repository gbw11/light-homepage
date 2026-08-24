import { readTakenAt } from "./exif";

/**
 * 브라우저 리사이즈 (ARCHITECTURE.md §4.2 · FR-PHO-08).
 *
 * 사진은 **백엔드를 통과하지 않는다** — 브라우저가 줄여서 R2로 직접 올린다
 * (ARCHITECTURE.md §7.3). 그래서 화질 정책이 서버가 아니라 여기에 있다:
 * 열람용 썸네일 640px, 확대·다운로드용 2560px. **촬영 원본은 보관하지 않는다**
 * (SPEC_FUNCTIONAL FR-PHO-04 — 화면에도 이 경계를 안내한다).
 */

/** 확대·다운로드용 장변 (SPEC_API §6.4 `viewUrl`) */
export const VIEW_MAX_EDGE = 2560;
/** 그리드 열람용 장변 — 200장 열람 전송량을 16MB 안에 두는 근거 (§6.4) */
export const THUMB_MAX_EDGE = 640;

const VIEW_QUALITY = 0.82;
const THUMB_QUALITY = 0.75;
const MIME = "image/webp";

export type ResizedPhoto = {
  /** 2560px WebP — `viewPutUrl`로 PUT */
  view: Blob;
  /** 640px WebP — `thumbPutUrl`로 PUT */
  thumb: Blob;
  /** 리사이즈 **후** 크기 (SPEC_API §6.5의 `width`/`height`가 요구하는 값) */
  width: number;
  height: number;
  /** EXIF 촬영 시각. 없으면 null */
  takenAt: string | null;
};

/**
 * 리사이즈 실패. **업로드 전체를 중단시키지 않는다** — 호출부는 이 파일만
 * 건너뛰고 사용자에게 목록으로 보여준다 (WORKPLAN §8.2 "리사이즈 실패(HEIC 등)
 * → 건너뛰고 사용자에게 목록 표시").
 */
export class ResizeError extends Error {
  constructor(
    message: string,
    readonly fileName: string,
  ) {
    super(message);
    this.name = "ResizeError";
  }
}

/** 장변을 `maxEdge`에 맞춘 크기. **확대하지 않는다** (작은 사진은 그대로) */
function fit(width: number, height: number, maxEdge: number) {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) return { width, height };
  const ratio = maxEdge / longEdge;
  // 0px canvas는 만들 수 없다 — 극단적인 비율에서도 최소 1px을 보장한다
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

async function drawToBlob(
  bitmap: ImageBitmap,
  size: { width: number; height: number },
  quality: number,
): Promise<Blob> {
  // OffscreenCanvas가 있으면 쓴다 — DOM에 붙지 않아 200장 처리 중 레이아웃을
  // 건드리지 않는다. 없는 브라우저(구형 Safari)는 일반 canvas로 내려간다.
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(size.width, size.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D 컨텍스트를 만들 수 없습니다.");
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    return canvas.convertToBlob({ type: MIME, quality });
  }

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D 컨텍스트를 만들 수 없습니다.");
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("이미지를 변환할 수 없습니다."))),
      MIME,
      quality,
    );
  });
}

/**
 * 파일 하나를 업로드용 2종(2560/640)으로 만든다.
 *
 * ⚠️ **회전은 EXIF 파서가 아니라 `imageOrientation: "from-image"`가 처리한다.**
 * 이걸 빼면 세로로 찍은 사진이 눕는다 — canvas에 그리는 순간 EXIF 회전
 * 정보가 사라지기 때문이다.
 *
 * @throws {ResizeError} 디코딩 불가(HEIC 등)·변환 실패
 */
export async function resizeForUpload(file: File): Promise<ResizedPhoto> {
  if (!file.type.startsWith("image/")) {
    throw new ResizeError("이미지 파일이 아닙니다.", file.name);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // HEIC/HEIF가 대표적이다 — Safari 외 브라우저는 디코딩하지 못한다
    throw new ResizeError(
      "이 브라우저가 열 수 없는 형식입니다. JPG·PNG로 저장한 뒤 다시 시도해 주세요.",
      file.name,
    );
  }

  try {
    const viewSize = fit(bitmap.width, bitmap.height, VIEW_MAX_EDGE);
    const thumbSize = fit(bitmap.width, bitmap.height, THUMB_MAX_EDGE);

    // 디코딩된 비트맵 하나로 두 번 그린다 (파일을 두 번 디코딩하지 않는다)
    const [view, thumb] = await Promise.all([
      drawToBlob(bitmap, viewSize, VIEW_QUALITY),
      drawToBlob(bitmap, thumbSize, THUMB_QUALITY),
    ]);

    return {
      view,
      thumb,
      width: viewSize.width,
      height: viewSize.height,
      takenAt: await readTakenAt(file),
    };
  } catch (error) {
    throw new ResizeError(
      error instanceof Error ? error.message : "이미지를 변환하지 못했습니다.",
      file.name,
    );
  } finally {
    // 명시적으로 놓아준다. 200장을 순회하는 동안 GC를 기다리면 메모리가 튄다
    bitmap.close();
  }
}
