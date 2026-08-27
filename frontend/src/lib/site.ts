/**
 * 사이트 절대 주소. OG 태그(`layout.tsx`)·`robots.txt`·`sitemap.xml`이 쓴다.
 *
 * ⚠️ **`??`가 아니라 `||`인 이유** — 2026-08-27에 Vercel 첫 배포가 이것 때문에
 * 실패했다.
 *
 * ```
 * metadataBase: new URL(SITE_URL)
 *   → ERR_INVALID_URL, input: ''
 * ```
 *
 * Vercel에 `NEXT_PUBLIC_SITE_URL` 키를 **값 없이** 만들면 `undefined`가 아니라
 * **빈 문자열 `""`이 주입된다.** `??`는 `null`·`undefined`만 걸러내므로 `""`는
 * 그대로 통과하고, `new URL("")`이 던진다. **환경변수를 비워둔 것 때문에 빌드가
 * 통째로 깨지면 안 된다.**
 *
 * ⚠️ 그리고 이 값은 **세 파일에 같은 형태로 중복돼 있었다.** 한 곳만 고치면
 * 나머지가 남아 같은 사고가 재발하므로 여기로 모았다 — 고칠 곳이 하나여야 한다.
 *
 * 값은 배포 환경에서 주입한다 (`infra/vercel/README.md §1②`).
 * 로컬 기본값은 `frontend/.env.example`과 같은 `http://localhost:3000`이다.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
