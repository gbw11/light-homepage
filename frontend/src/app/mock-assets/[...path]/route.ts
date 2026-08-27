import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

/**
 * mock 개발용 자산 서버 — **로컬 개발에서만 응답한다.**
 *
 * ## 왜 이게 있는가
 *
 * `frontend/mock-assets/photos/retreat-2026/`에는 **얼굴이 식별되는 실제 인물
 * 사진 47장**이 있다. 전에는 `public/photos/`에 있었는데, `public/`은 Next가
 * **인증 없이 정적 서빙**하므로 "회원 사진은 로그인 뒤에 둔다"는 결정이 그
 * 경로로 우회됐다 (`docs/DECISIONS.md` 2026-08-24).
 *
 * 그래서 자산을 `public/` 밖으로 빼고, 이 route handler가 **개발 환경에서만**
 * 서빙한다 — 3안 중 **1안**(PM 결정 2026-08-27).
 *
 * ## 🔴 `.vercelignore`(2안)는 동작하지 않았다
 *
 * 2026-08-27 Vercel 첫 배포에서 **실측으로 확인했다** — `.vercelignore`에
 * `public/photos`를 적어뒀는데도 `/photos/retreat-2026/thumb/p001.webp`가
 * **200으로 서빙됐다.** Git 연동 배포에서는 그 파일이 효과가 없다.
 * **"제외했다고 믿는 장치"가 실제로는 아무것도 막지 않고 있었다.**
 *
 * → 이 handler는 플랫폼 설정에 의존하지 않는다. 코드가 막는다.
 *
 * ## ⚠️ 게이트가 `NODE_ENV`인 이유 (`NEXT_PUBLIC_USE_MOCK`이 아니다)
 *
 * 원래 1안 설계는 "`mock=1`일 때만 응답"이었다. 그런데 **지금 Vercel 데모가
 * `NEXT_PUBLIC_USE_MOCK=1`로 떠 있다** — mock 여부로 게이트하면 그 배포에서
 * 그대로 서빙된다. 배포 전체를 막으려면 `NODE_ENV`여야 한다.
 *
 * 대가: **배포된 데모에서는 사진첩 이미지가 보이지 않는다.** 개인정보가
 * 우선이므로 감수한다. 실서비스는 R2 presigned URL로 서빙하므로 이 자산이
 * 운영에 필요하지 않다는 점은 확실하다 (`SPEC_API §6.4`).
 */

/** 자산 루트. `frontend/mock-assets/` 밖으로는 절대 나가지 않는다. */
const ASSET_ROOT = path.join(process.cwd(), "mock-assets");

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".json": "application/json",
};

function notFound() {
  // 존재 여부를 알려주지 않는다 — 404와 403을 구분하면 경로를 탐색할 수 있다
  return new Response("Not Found", { status: 404 });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  // ★ 배포에서는 무조건 404. 이 한 줄이 이 파일의 존재 이유다.
  if (process.env.NODE_ENV === "production") return notFound();

  const { path: segments } = await params;
  if (!segments?.length) return notFound();

  const target = path.resolve(ASSET_ROOT, ...segments);

  // ⚠️ 경로 탈출 방어 — `..`가 섞이면 ASSET_ROOT 밖을 가리킬 수 있다.
  //    개발 서버에도 이 방어를 둔다: 로컬이라고 해서 임의 파일 읽기를 허용할
  //    이유가 없고, 이 handler가 나중에 다른 조건으로 열릴 수도 있다.
  if (target !== ASSET_ROOT && !target.startsWith(ASSET_ROOT + path.sep)) {
    return notFound();
  }

  if (!existsSync(target) || !statSync(target).isFile()) return notFound();

  const contentType =
    CONTENT_TYPES[path.extname(target).toLowerCase()] ??
    "application/octet-stream";

  const stream = Readable.toWeb(
    createReadStream(target),
  ) as unknown as ReadableStream;

  return new Response(stream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(statSync(target).size),
      // 개발 편의: 캐시하지 않는다. 자산을 교체하며 확인하는 일이 잦다.
      "Cache-Control": "no-store",
      // 혹시라도 노출되는 경로가 생기면 색인만이라도 막는다
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
