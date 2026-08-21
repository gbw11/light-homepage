import type { ApiEnvelope } from "@/types/api";
import { ApiError } from "./error";
import type { Api } from "./types";

/**
 * 실제 백엔드 호출. **직접 import하지 않는다** — `@/lib/api`(index)만 쓴다.
 *
 * 동일 출처(`/api/**` → next.config.ts rewrites)라서
 *   · CORS 설정이 필요 없고
 *   · 쿠키는 기본값으로 실려간다 (credentials 'same-origin')
 * FE는 JWT를 직접 다루지 않는다 (SPEC_API §1.4).
 */
async function request<T>(
  path: string,
  init?: RequestInit & { query?: Record<string, string | number | undefined> },
): Promise<T> {
  const { query, ...rest } = init ?? {};

  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined) search.set(k, String(v));
  }
  const qs = search.toString();

  const res = await fetch(`/api${path}${qs ? `?${qs}` : ""}`, {
    ...rest,
    headers: { "Content-Type": "application/json", ...rest.headers },
  });

  let body: ApiEnvelope<T>;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    // 규약을 벗어난 응답 (프록시 실패·502 HTML 등)
    throw new ApiError({
      code: "NOT_FOUND",
      message: `서버 응답을 해석할 수 없습니다 (${res.status})`,
      status: res.status,
    });
  }

  if ("error" in body) {
    throw new ApiError({ ...body.error, status: res.status });
  }
  return body.data;
}

export const realApi: Api = {
  posts: {
    list: ({ category, page = 0, size = 20 }) =>
      request("/posts", { query: { category, page, size } }),
    get: (idOrSlug) => request(`/posts/${encodeURIComponent(idOrSlug)}`),
  },
};
