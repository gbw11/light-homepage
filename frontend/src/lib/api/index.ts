import { mockApi } from "./mock";
import { realApi } from "./real";
import type { Api } from "./types";

/**
 * ★ API 계층의 유일한 진입점.
 *
 * 화면 코드는 **항상 `@/lib/api`만 import**한다.
 * `real.ts`·`mock.ts`를 직접 import하면 이 스위치가 무력해진다.
 *
 *   NEXT_PUBLIC_USE_MOCK=1  → 백엔드 없이 개발
 *   NEXT_PUBLIC_USE_MOCK=0  → 실제 백엔드 (기본)
 */
export const api: Api =
  process.env.NEXT_PUBLIC_USE_MOCK === "1" ? mockApi : realApi;

export { ApiError, isApiError } from "./error";
export type { Api } from "./types";
